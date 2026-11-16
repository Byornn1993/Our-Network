import { z } from 'zod';
import type { Store } from '@/lib/db/store';
import { change, newId, write, type Change } from '@/lib/db/repo';
import { SYNC_TABLES, type SyncTable } from '@/lib/db/types';
import { fullName } from '@/domain/people';
import { getBackend } from '@/lib/backend';

// Back-up: alle gedeelde gegevens als JSON. Versie 2 bevat ook de foto's zelf (als data-URL), zodat een
// back-up ook naar een andere opslag kan (bv. van de claude.ai-artifact naar de app met Supabase).
// Importeren VOEGT SAMEN: nieuwe rijen worden toegevoegd, bestaande enkel overschreven als de back-up nieuwer is
// (of altijd, met "back-up gaat voor").

export const BACKUP_FORMAT = 'our-network-backup';

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.union([z.literal(1), z.literal(2)]),
  exported_at: z.string(),
  /** Versie 2: foto's per oude opslagsleutel, als data-URL. */
  // Een onbruikbare foto keurt niet de hele back-up af: die wordt bij het importeren overgeslagen en gemeld.
  files: z.record(z.string(), z.string()).optional(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.guid(), updated_at: z.string() })))),
});

export function buildBackup(s: Store) {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = (s.raw[t] as unknown as Record<string, unknown>[]).map(({ _base: _b, ...row }) => row);
  return { format: BACKUP_FORMAT, version: 1 as 1 | 2, exported_at: new Date().toISOString(), tables };
}

/** Opslagsleutels van alle foto's waar de gegevens naar verwijzen. */
export function photoKeys(s: Store): string[] {
  const keys = [
    ...s.raw.persons.map((p) => p.avatar_path),
    ...s.raw.profiles.map((p) => p.avatar_path),
    ...s.raw.event_photos.flatMap((p) => [p.storage_path, p.thumb_path]),
  ];
  return [...new Set(keys.filter((k): k is string => !!k))];
}

const toDataUrl = (blob: Blob) =>
  new Promise<string>((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(String(r.result));
    r.onerror = () => reject(r.error ?? new Error('Foto lezen mislukt'));
    r.readAsDataURL(blob);
  });

/** Back-up mét foto's. Foto's die niet (meer) te laden zijn, worden overgeslagen en geteld. */
export async function buildFullBackup(s: Store): Promise<{ backup: ReturnType<typeof buildBackup> & { files: Record<string, string> }; missing: number }> {
  const keys = photoKeys(s);
  const urls = keys.length ? await getBackend().storage.signedUrls(keys) : {};
  const files: Record<string, string> = {};
  let missing = 0;
  for (const key of keys) {
    try {
      const res = await fetch(urls[key]!);
      if (!res.ok) throw new Error(String(res.status));
      files[key] = await toDataUrl(await res.blob());
    } catch {
      missing++;
    }
  }
  return { backup: { ...buildBackup(s), version: 2 as const, files }, missing };
}

/** Bestand aanbieden. In de Artifact via `downloads` (de kijker bevestigt), elders als gewone browserdownload. */
export async function download(filename: string, content: string, type: string): Promise<void> {
  const save = getBackend().saveFile;
  if (save) return save(filename, content);
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

const csvCell = (v: unknown) => {
  const s = v === null || v === undefined ? '' : String(v);
  return /[;"\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
};

/** Personen als CSV (puntkomma's, UTF-8 met BOM) zodat Excel in nl-BE het meteen goed opent. */
export function personsCsv(s: Store): string {
  const header = ['Voornaam', 'Achternaam', 'Categorie', 'Verbonden met', 'Telefoon', 'E-mail', 'Geboortedatum', 'Leren kennen', 'Waar van', 'Beschrijving', 'Hobby’s', 'Interesses', 'Gearchiveerd'];
  const rows = s.persons
    .slice()
    .sort((a, b) => fullName(a).localeCompare(fullName(b), 'nl'))
    .map((p) => [
      p.first_name,
      p.last_name,
      s.categoryById.get(p.category_id)?.name,
      s.person_connections
        .filter((c) => c.person_id === p.id)
        .map((c) => s.profileById.get(c.profile_id)?.name)
        .join(' & '),
      p.phone,
      p.email,
      p.birth_date,
      p.first_met_at,
      p.met_via,
      p.description,
      p.hobbies,
      p.interests,
      p.archived_at ? 'ja' : '',
    ]);
  return '﻿' + [header, ...rows].map((r) => r.map(csvCell).join(';')).join('\r\n');
}

export interface ImportResult {
  added: number;
  updated: number;
  skipped: number;
  photos: number;
  /** Foto's die niet opgeslagen konden worden; de rij is wel geïmporteerd, zonder die foto. */
  photoErrors: number;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function importBackup(s: Store, text: string, opts: { overwrite?: boolean } = {}): Promise<ImportResult> {
  let parsed: z.infer<typeof backupSchema>;
  try {
    parsed = backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error('Dit is geen geldige Our Network-back-up (JSON).');
  }
  const result: ImportResult = { added: 0, updated: 0, skipped: 0, photos: 0, photoErrors: 0 };
  const files = parsed.files ?? {};
  const storage = getBackend().storage;
  // Foto uit de back-up opnieuw opslaan onder een sleutel van deze opslag; geeft de nieuwe sleutel.
  const moved = new Map<string, string | null>();
  // Eén foto die niet lukt (verkeerd type, netwerk, opslag vol) mag de rest van de import niet tegenhouden.
  const reupload = async (key: unknown, path: string): Promise<unknown> => {
    if (typeof key !== 'string' || !(key in files)) return key;
    if (!moved.has(key)) {
      try {
        const data = files[key]!;
        if (!data.startsWith('data:image/')) throw new Error('geen afbeelding');
        const blob = await (await fetch(data)).blob();
        moved.set(key, await storage.upload(path, blob));
        result.photos++;
      } catch {
        moved.set(key, null);
        result.photoErrors++;
      }
    }
    return moved.get(key);
  };
  const changes: Change[] = [];
  for (const table of SYNC_TABLES) {
    const local = new Map((s.raw[table] as unknown as { id: string; updated_at: string }[]).map((r) => [r.id, r]));
    for (const row of parsed.tables[table] ?? []) {
      const cur = local.get(row.id);
      if (cur && !opts.overwrite && Date.parse(cur.updated_at) >= Date.parse(row.updated_at)) {
        result.skipped++;
        continue;
      }
      if (cur) result.updated++;
      else result.added++;
      const { created_by: _c, _base: _b, ...clean } = row as Record<string, unknown>;
      if (table === 'persons' || table === 'profiles') {
        clean.avatar_path = await reupload(clean.avatar_path, `avatars/${table}/${row.id}/${newId()}.jpg`);
      }
      if (table === 'profiles' && typeof clean.user_id === 'string' && !UUID.test(clean.user_id)) {
        // Koppeling met een account van een andere opslag (bv. artifact-gebruiker): opnieuw "Dit ben ik" kiezen.
        clean.user_id = null;
      }
      if (table === 'event_photos') {
        clean.storage_path = await reupload(clean.storage_path, `events/${String(clean.event_id)}/${row.id}.jpg`);
        clean.thumb_path = await reupload(clean.thumb_path, `events/${String(clean.event_id)}/${row.id}_thumb.jpg`);
      }
      changes.push(change(table as SyncTable, clean as never));
    }
  }
  // In één keer: de outbox bewaart de volgorde (ouders vóór kinderen).
  await write(changes);
  return result;
}
