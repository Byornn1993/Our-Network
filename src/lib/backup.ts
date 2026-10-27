import { z } from 'zod';
import type { Store } from '@/lib/db/store';
import { change, write, type Change } from '@/lib/db/repo';
import { SYNC_TABLES, type SyncTable } from '@/lib/db/types';
import { fullName } from '@/domain/people';

// Back-up: alle gedeelde gegevens als JSON (foto's zelf zitten in Supabase Storage; enkel hun paden).
// Importeren VOEGT SAMEN: nieuwe rijen worden toegevoegd, bestaande enkel overschreven als de back-up nieuwer is.

export const BACKUP_FORMAT = 'our-network-backup';

const backupSchema = z.object({
  format: z.literal(BACKUP_FORMAT),
  version: z.literal(1),
  exported_at: z.string(),
  tables: z.record(z.string(), z.array(z.record(z.string(), z.unknown()).and(z.object({ id: z.string().uuid(), updated_at: z.string() })))),
});

export function buildBackup(s: Store) {
  const tables: Record<string, unknown[]> = {};
  for (const t of SYNC_TABLES) tables[t] = (s.raw[t] as unknown as Record<string, unknown>[]).map(({ _base: _b, ...row }) => row);
  return { format: BACKUP_FORMAT, version: 1 as const, exported_at: new Date().toISOString(), tables };
}

export function download(filename: string, content: string, type: string) {
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
}

export async function importBackup(s: Store, text: string): Promise<ImportResult> {
  let parsed: z.infer<typeof backupSchema>;
  try {
    parsed = backupSchema.parse(JSON.parse(text));
  } catch {
    throw new Error('Dit is geen geldige Our Network-back-up (JSON).');
  }
  const result: ImportResult = { added: 0, updated: 0, skipped: 0 };
  const changes: Change[] = [];
  for (const table of SYNC_TABLES) {
    const local = new Map((s.raw[table] as unknown as { id: string; updated_at: string }[]).map((r) => [r.id, r]));
    for (const row of parsed.tables[table] ?? []) {
      const cur = local.get(row.id);
      if (cur && Date.parse(cur.updated_at) >= Date.parse(row.updated_at)) {
        result.skipped++;
        continue;
      }
      if (cur) result.updated++;
      else result.added++;
      const { created_by: _c, _base: _b, ...clean } = row as Record<string, unknown>;
      changes.push(change(table as SyncTable, clean as never));
    }
  }
  // In één keer: de outbox bewaart de volgorde (ouders vóór kinderen).
  await write(changes);
  return result;
}
