import { useEffect, useState } from 'react';
import { newId } from '@/lib/db/repo';
import { getBackend } from '@/lib/backend';

// Afbeeldingen worden in de browser verkleind en als JPEG opgeslagen (werkt overal, ook op iOS).
// Browsers passen de EXIF-oriëntatie automatisch toe bij het tekenen, dus foto's staan rechtop.

export const AVATAR_SIZE = 512;
const PHOTO_MAX = 1600;
const THUMB_MAX = 480;

export function loadImage(file: Blob): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Deze afbeelding kan niet gelezen worden. Kies een JPG, PNG of HEIC-foto uit je galerij.'));
    };
    img.src = url;
  });
}

function canvasToJpeg(canvas: HTMLCanvasElement, quality: number): Promise<Blob> {
  return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Comprimeren mislukt'))), 'image/jpeg', quality));
}

export async function resizeToJpeg(img: HTMLImageElement, maxSide: number, quality = 0.82): Promise<{ blob: Blob; width: number; height: number }> {
  const scale = Math.min(1, maxSide / Math.max(img.naturalWidth, img.naturalHeight));
  const width = Math.max(1, Math.round(img.naturalWidth * scale));
  const height = Math.max(1, Math.round(img.naturalHeight * scale));
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.drawImage(img, 0, 0, width, height);
  return { blob: await canvasToJpeg(canvas, quality), width, height };
}

export interface SquareCrop {
  /** Linkerbovenhoek en zijde van het vierkant, in pixels van het origineel. */
  x: number;
  y: number;
  size: number;
}

export async function cropSquare(img: HTMLImageElement, crop: SquareCrop, out = AVATAR_SIZE): Promise<Blob> {
  const canvas = document.createElement('canvas');
  const size = Math.min(out, Math.round(crop.size));
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d')!;
  ctx.imageSmoothingQuality = 'high';
  ctx.fillStyle = '#2c3e50';
  ctx.fillRect(0, 0, size, size);
  ctx.drawImage(img, crop.x, crop.y, crop.size, crop.size, 0, 0, size, size);
  return canvasToJpeg(canvas, 0.86);
}

// ───────────────────────── opslag ─────────────────────────

export async function uploadAvatar(kind: 'persons' | 'profiles', ownerId: string, blob: Blob): Promise<string> {
  // Nieuwe bestandsnaam bij elke wijziging: geen verouderde versies in caches.
  return getBackend().storage.upload(`avatars/${kind}/${ownerId}/${newId()}.jpg`, blob);
}

export async function uploadEventPhoto(eventId: string, file: Blob): Promise<{ id: string; storage_path: string; thumb_path: string; width: number; height: number }> {
  const img = await loadImage(file);
  try {
    const full = await resizeToJpeg(img, PHOTO_MAX, 0.82);
    const thumb = await resizeToJpeg(img, THUMB_MAX, 0.78);
    const id = newId();
    const backend = getBackend();
    // De backend bepaalt de definitieve sleutel (Supabase: dit pad; artifact: een asset-id).
    const storage_path = await backend.storage.upload(`events/${eventId}/${id}.jpg`, full.blob);
    const thumb_path = await backend.storage.upload(`events/${eventId}/${id}_thumb.jpg`, thumb.blob);
    return { id, storage_path, thumb_path, width: full.width, height: full.height };
  } finally {
    URL.revokeObjectURL(img.src);
  }
}

export async function removeFiles(paths: (string | null | undefined)[]): Promise<void> {
  const list = paths.filter((p): p is string => !!p);
  if (list.length) await getBackend().storage.remove(list).catch(() => {});
}

// ───────────────────────── tonen (signed URLs) ─────────────────────────
// Verzoeken uit dezelfde render worden gebundeld tot één createSignedUrls-aanroep.
// URL's blijven in het geheugen (niet op schijf) en worden vernieuwd vóór ze verlopen.

const TTL_MS = 50 * 60 * 1000;
const cache = new Map<string, { url: string; at: number }>();
const waiting = new Map<string, ((url: string | null) => void)[]>();
let timer: ReturnType<typeof setTimeout> | null = null;

function flush() {
  timer = null;
  const paths = [...waiting.keys()];
  const cbs = new Map(waiting);
  waiting.clear();
  getBackend()
    .storage.signedUrls(paths)
    .then((urls) => {
      for (const p of paths) {
        const url = urls[p] ?? null;
        if (url) cache.set(p, { url, at: Date.now() });
        cbs.get(p)?.forEach((cb) => cb(url));
      }
    })
    .catch(() => paths.forEach((p) => cbs.get(p)?.forEach((cb) => cb(null))));
}

export function requestSignedUrl(path: string): Promise<string | null> {
  const hit = cache.get(path);
  if (hit && Date.now() - hit.at < TTL_MS) return Promise.resolve(hit.url);
  return new Promise((resolve) => {
    waiting.set(path, [...(waiting.get(path) ?? []), resolve]);
    if (!timer) timer = setTimeout(flush, 16);
  });
}

export function cachedUrl(path: string | null | undefined): string | null {
  if (!path) return null;
  const hit = cache.get(path);
  return hit && Date.now() - hit.at < TTL_MS ? hit.url : null;
}

/** URL om een privébestand te tonen; null zolang die geladen wordt of offline. */
export function useSignedUrl(path: string | null | undefined): string | null {
  const [state, setState] = useState<{ path: string | null | undefined; url: string | null }>({ path, url: cachedUrl(path) });
  useEffect(() => {
    if (!path) return;
    let alive = true;
    void requestSignedUrl(path).then((url) => alive && setState({ path, url }));
    return () => {
      alive = false;
    };
  }, [path]);
  return state.path === path ? state.url : cachedUrl(path);
}
