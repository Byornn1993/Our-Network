import Dexie, { type Table } from 'dexie';
import { v5 } from 'uuid';
import { SYNC_TABLES } from '@/lib/db/types';
import type { AuthEvent, AuthUser, Backend, Member } from './types';

// ALLEEN VOOR ONTWIKKELING EN E2E-TESTS (`npm run dev:local`).
// Bootst Supabase na in de browser: auth (elk e-mailadres met wachtwoord "dev-password"),
// tabellen met server-updated_at, het lidmaatschap en storage. Wordt nooit in de productiebuild opgenomen.

const DEV_PASSWORD = 'dev-password';
const NS = '0b7f5b0e-1f1c-4a55-9e4e-6c3a4b2d1e00';
const AUTH_KEY = 'ournetwork-local-auth';

interface Row {
  id: string;
  updated_at: string;
  [k: string]: unknown;
}

class LocalServer extends Dexie {
  files!: Table<{ path: string; blob: Blob }, string>;
  members!: Table<Member, string>;
  invites!: Table<{ email: string }, string>;
  constructor() {
    super('ournetwork-local-backend');
    const stores: Record<string, string> = { files: 'path', members: 'user_id', invites: 'email' };
    for (const t of SYNC_TABLES) stores[t] = 'id';
    this.version(1).stores(stores);
  }
}

// Zelfde standaardinhoud als supabase/migrations/20261027000300_defaults.sql
const P = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`;
const DEFAULTS: Record<string, Record<string, unknown>[]> = {
  profiles: [
    { id: P(1), slot: 1, name: 'Bjorn', avatar_path: null, user_id: null },
    { id: P(2), slot: 2, name: 'Stephanie', avatar_path: null, user_id: null },
  ],
  categories: [
    [101, 'Familie', 'Ouders, broers, zussen en de rest van de familie.', '#E9B949', 'home', 1, 52, 'family', 1],
    [102, 'Beste vrienden', 'De mensen bij wie we altijd terechtkunnen.', '#F26B1D', 'heart', 2, 48, 'friends', 2],
    [103, 'Goede vrienden', 'Vrienden die we graag en geregeld zien.', '#F5A266', 'smile', 3, 44, 'friends', 3],
    [104, "Collega's", 'Mensen van het werk.', '#6BB8E8', 'briefcase', 3, 42, 'colleagues', 4],
    [105, 'Kennissen', 'Mensen die we kennen, maar minder vaak zien.', '#8A9590', 'user', 4, 38, 'acquaintances', 5],
  ].map(([n, name, description, color, icon, ring, avatar_size, group_key, display_order]) => ({
    id: P(n as number), name, description, color, icon, ring, avatar_size, group_key, display_order, archived_at: null,
  })),
  event_categories: [
    [201, 'first_meeting', 'Eerste ontmoeting', '#62E3B0', 'handshake'],
    [202, 'new_relationship', 'Nieuwe relatie', '#F26B1D', 'heart'],
    [203, 'family', 'Familiegebeurtenis', '#E9B949', 'home'],
    [204, 'friendship', 'Vriendschapsmoment', '#F5A266', 'party'],
    [205, 'social_change', 'Sociale verandering', '#6BB8E8', 'shuffle'],
    [206, 'memory', 'Belangrijke herinnering', '#C9A7F5', 'star'],
    [207, 'birthday', 'Verjaardag', '#F28CB1', 'cake'],
  ].map(([n, system_key, name, color, icon], i) => ({ id: P(n as number), system_key, name, color, icon, display_order: i + 1, archived_at: null })),
};

let lastTs = 0;
function serverNow(): string {
  lastTs = Math.max(Date.now(), lastTs + 1);
  return new Date(lastTs).toISOString();
}

export function createLocalBackend(): Backend {
  const server = new LocalServer();
  const listeners = new Set<(u: AuthUser | null, e: AuthEvent) => void>();
  const readUser = (): AuthUser | null => {
    try {
      return JSON.parse(localStorage.getItem(AUTH_KEY) ?? 'null') as AuthUser | null;
    } catch {
      return null;
    }
  };
  const seeded = (async () => {
    for (const [table, rows] of Object.entries(DEFAULTS)) {
      const t = server.table(table);
      if ((await t.count()) > 0) continue;
      const now = serverNow();
      await t.bulkPut(rows.map((r) => ({ ...r, created_at: now, updated_at: now, deleted_at: null, created_by: null })));
    }
  })();
  const isMember = async () => {
    const u = readUser();
    return !!u && !!(await server.members.get(u.id));
  };
  const requireMember = async () => {
    if (!(await isMember())) throw new Error('permission denied (geen lid)');
  };

  return {
    kind: 'local',
    auth: {
      async getUser() {
        return readUser();
      },
      onChange(cb) {
        listeners.add(cb);
        return () => listeners.delete(cb);
      },
      async signIn(email, password) {
        if (password !== DEV_PASSWORD) throw new Error('Invalid login credentials');
        const user = { id: v5(email.trim().toLowerCase(), NS), email: email.trim().toLowerCase() };
        localStorage.setItem(AUTH_KEY, JSON.stringify(user));
        listeners.forEach((l) => l(user, 'SIGNED_IN'));
      },
      async signOut() {
        localStorage.removeItem(AUTH_KEY);
        listeners.forEach((l) => l(null, 'SIGNED_OUT'));
      },
      async sendResetLink() {},
      async updatePassword() {},
    },
    async claimMembership() {
      const u = readUser();
      if (!u) return false;
      if (await server.members.get(u.id)) return true;
      if ((await server.members.count()) === 0 || (await server.invites.get(u.email))) {
        await server.members.put({ user_id: u.id, email: u.email, created_at: serverNow() });
        return true;
      }
      return false;
    },
    members: {
      async list() {
        await requireMember();
        return server.members.toArray();
      },
      async invites() {
        await requireMember();
        return (await server.invites.toArray()).map((i) => i.email);
      },
      async invite(email) {
        await requireMember();
        await server.invites.put({ email: email.trim().toLowerCase() });
      },
      async revokeInvite(email) {
        await requireMember();
        await server.invites.delete(email);
      },
    },
    remote: {
      async upsert(table, row) {
        await seeded;
        await requireMember();
        const t = server.table(table);
        const old = (await t.get(row.id as string)) as Row | undefined;
        const updated_at = serverNow();
        await t.put({ ...old, ...row, created_at: old?.created_at ?? row.created_at, created_by: old ? old.created_by : readUser()?.id, updated_at });
        return updated_at;
      },
      async fetchSince(table, since, from, to) {
        await seeded;
        await requireMember();
        const user = readUser();
        const rows = ((await server.table(table).toArray()) as Row[])
          .filter((r) => !since || Date.parse(r.updated_at) > Date.parse(since))
          // privé-herinneringen: zoals de RLS-policy, enkel voor de maker
          .filter((r) => table !== 'events' || !r.is_private || r.created_by === user?.id)
          .sort((a, b) => a.updated_at.localeCompare(b.updated_at) || a.id.localeCompare(b.id));
        return rows.slice(from, to + 1);
      },
    },
    storage: {
      async upload(path, blob) {
        await requireMember();
        await server.files.put({ path, blob });
      },
      async remove(paths) {
        await requireMember();
        await server.files.bulkDelete(paths);
      },
      async signedUrls(paths) {
        await requireMember();
        const out: Record<string, string> = {};
        for (const f of await server.files.bulkGet(paths)) if (f) out[f.path] = URL.createObjectURL(f.blob);
        return out;
      },
    },
  };
}
