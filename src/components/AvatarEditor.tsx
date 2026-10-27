import { useEffect, useRef, useState } from 'react';
import { Camera, Trash2 } from 'lucide-react';
import { Sheet } from '@/components/ui/Sheet';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/Avatar';
import { cropSquare, loadImage, type SquareCrop } from '@/lib/images';
import { useSyncStatus } from '@/lib/sync/status';

const V = 280; // zijde van het uitsnedevenster in px

/** Vierkante uitsnede kiezen: slepen om te verschuiven, schuifregelaar om in te zoomen. */
function CropSheet({ file, onCancel, onDone }: { file: File; onCancel: () => void; onDone: (blob: Blob) => void }) {
  const [img, setImg] = useState<HTMLImageElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [zoom, setZoom] = useState(1);
  const [off, setOff] = useState({ x: 0, y: 0 });
  const [busy, setBusy] = useState(false);
  const dragStart = useRef<{ px: number; py: number; ox: number; oy: number } | null>(null);

  useEffect(() => {
    let url: string | null = null;
    loadImage(file)
      .then((i) => {
        url = i.src;
        setImg(i);
      })
      .catch((e: Error) => setError(e.message));
    return () => {
      if (url) URL.revokeObjectURL(url);
    };
  }, [file]);

  const w = img?.naturalWidth ?? 1;
  const h = img?.naturalHeight ?? 1;
  const scale = (V / Math.min(w, h)) * zoom;
  const maxX = (w * scale - V) / 2;
  const maxY = (h * scale - V) / 2;
  const ox = Math.max(-maxX, Math.min(maxX, off.x));
  const oy = Math.max(-maxY, Math.min(maxY, off.y));
  const left = V / 2 - (w * scale) / 2 + ox;
  const top = V / 2 - (h * scale) / 2 + oy;

  const done = async () => {
    if (!img) return;
    setBusy(true);
    const crop: SquareCrop = { x: -left / scale, y: -top / scale, size: V / scale };
    try {
      onDone(await cropSquare(img, crop));
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setBusy(false);
    }
  };

  return (
    <Sheet open onClose={onCancel} title="Profielfoto uitsnijden">
      <div className="flex flex-col items-center gap-4 p-4">
        {error ? (
          <p className="text-sm text-danger">{error}</p>
        ) : (
          <div
            className="relative overflow-hidden rounded-2xl bg-surface"
            style={{ width: V, height: V, touchAction: 'none' }}
            onPointerDown={(e) => {
              (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
              dragStart.current = { px: e.clientX, py: e.clientY, ox, oy };
            }}
            onPointerMove={(e) => {
              const d = dragStart.current;
              if (d) setOff({ x: d.ox + e.clientX - d.px, y: d.oy + e.clientY - d.py });
            }}
            onPointerUp={() => (dragStart.current = null)}
          >
            {img && <img src={img.src} alt="" draggable={false} className="absolute max-w-none select-none" style={{ left, top, width: w * scale, height: h * scale }} />}
            <div aria-hidden className="pointer-events-none absolute inset-0 rounded-2xl" style={{ boxShadow: `inset 0 0 0 ${V}px rgba(0,0,0,0)`, background: 'radial-gradient(circle at center, transparent 69.5%, rgba(8,13,12,0.65) 70%)' }} />
          </div>
        )}
        <label className="flex w-full max-w-[280px] items-center gap-3 text-sm text-muted">
          Zoom
          <input type="range" min={1} max={4} step={0.01} value={zoom} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-[var(--accent)]" />
        </label>
        <div className="flex w-full gap-2">
          <Button block onClick={onCancel}>
            Annuleren
          </Button>
          <Button block variant="primary" loading={busy} disabled={!img} onClick={() => void done()}>
            Gebruiken
          </Button>
        </div>
      </div>
    </Sheet>
  );
}

/**
 * Profielfoto kiezen/wijzigen/verwijderen. Uploaden vraagt een verbinding (foto's staan in Supabase Storage);
 * dat wordt duidelijk gemeld i.p.v. stil te mislukken.
 */
export function AvatarPicker({
  path,
  name,
  color,
  size = 96,
  onUpload,
  onRemove,
}: {
  path: string | null;
  name: string;
  color?: string;
  size?: number;
  onUpload: (blob: Blob) => Promise<void>;
  onRemove?: () => Promise<void>;
}) {
  const input = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { online } = useSyncStatus();

  const upload = async (blob: Blob) => {
    setFile(null);
    setBusy(true);
    setError(null);
    try {
      await onUpload(blob);
    } catch (e) {
      setError(!navigator.onLine ? 'Je bent offline. Foto’s uploaden kan zodra je weer verbinding hebt.' : e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex flex-col items-center gap-2">
      <button type="button" className="relative rounded-full" onClick={() => input.current?.click()} aria-label="Profielfoto kiezen" disabled={busy}>
        <Avatar path={path} name={name || '?'} size={size} color={color} />
        <span className="absolute bottom-0 right-0 flex h-8 w-8 items-center justify-center rounded-full border-2 border-[var(--card)] bg-accent text-accent-ink">
          {busy ? <span className="h-4 w-4 animate-spin rounded-full border-2 border-current border-t-transparent" /> : <Camera size={15} />}
        </span>
      </button>
      <input
        ref={input}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0];
          e.target.value = '';
          if (f) setFile(f);
        }}
      />
      {!online && <p className="text-center text-xs text-warn">Offline: foto’s kunnen pas online geüpload worden.</p>}
      {path && onRemove && (
        <button type="button" className="flex items-center gap-1 text-xs text-muted hover:text-danger" onClick={() => void onRemove()}>
          <Trash2 size={12} /> Foto verwijderen
        </button>
      )}
      {error && <p className="text-center text-xs text-danger">{error}</p>}
      {file && <CropSheet file={file} onCancel={() => setFile(null)} onDone={(b) => void upload(b)} />}
    </div>
  );
}
