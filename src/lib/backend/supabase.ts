import { createClient, type PostgrestError } from '@supabase/supabase-js';
import { RemoteError } from '@/lib/sync/engine';
import type { AuthEvent, AuthUser, Backend } from './types';

// Alleen de publieke URL en de publishable/anon key. Nooit een service-role/secret key in de frontend.
// Our Network is een gast-app in het Supabase-project van Be Strong (zie SUPABASE_SHARED.md):
// alle tabellen en functies heten net_…, de foto's staan in de eigen bucket net-photos.
const BUCKET = 'net-photos';
const PREFIX = 'net_';
const tbl = (name: string) => PREFIX + name;
const SIGNED_URL_TTL = 60 * 60;

function toError(e: PostgrestError | Error | null | unknown): RemoteError {
  const offline = typeof navigator !== 'undefined' && navigator.onLine === false;
  if (e && typeof e === 'object' && 'code' in e && (e as PostgrestError).code) {
    const pe = e as PostgrestError;
    return new RemoteError(`${pe.message}${pe.details ? ` (${pe.details})` : ''}`, offline);
  }
  const msg = e instanceof Error ? e.message : e && typeof e === 'object' && 'message' in e ? String((e as { message: unknown }).message) : String(e);
  const network = offline || /fetch|network|timeout|load failed/i.test(msg);
  return new RemoteError(msg, network);
}

export function createSupabaseBackend(url: string, key: string): Backend {
  const client = createClient(url, key, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, storageKey: 'ournetwork-auth' },
  });
  const toUser = (u: { id: string; email?: string } | null | undefined): AuthUser | null => (u ? { id: u.id, email: u.email ?? '' } : null);

  return {
    kind: 'supabase',
    auth: {
      // getSession werkt ook offline: de sessie staat lokaal. Zo opent de app zonder netwerk.
      async getUser() {
        const { data } = await client.auth.getSession();
        return toUser(data.session?.user);
      },
      onChange(cb) {
        const { data } = client.auth.onAuthStateChange((event, session) => {
          const e: AuthEvent = event === 'SIGNED_IN' || event === 'SIGNED_OUT' || event === 'PASSWORD_RECOVERY' ? event : 'OTHER';
          cb(toUser(session?.user), e);
        });
        return () => data.subscription.unsubscribe();
      },
      async signIn(email, password) {
        const { error } = await client.auth.signInWithPassword({ email, password });
        if (error) throw error;
      },
      async signOut() {
        const { error } = await client.auth.signOut({ scope: 'local' }); // enkel deze app op dit toestel, niet Be Strong of Boodschappenlijst
        if (error) throw error;
      },
      async sendResetLink(email, redirectTo) {
        const { error } = await client.auth.resetPasswordForEmail(email, { redirectTo });
        if (error) throw error;
      },
      async updatePassword(password) {
        const { error } = await client.auth.updateUser({ password });
        if (error) throw error;
      },
    },
    async claimMembership() {
      const { data, error } = await client.rpc(tbl('claim_membership'));
      if (error) throw toError(error);
      return data === true;
    },
    members: {
      async list() {
        const { data, error } = await client.from(tbl('members')).select('user_id, email, created_at').order('created_at');
        if (error) throw toError(error);
        return data ?? [];
      },
      async invites() {
        const { data, error } = await client.from(tbl('allowed_emails')).select('email').order('created_at');
        if (error) throw toError(error);
        return (data ?? []).map((r) => r.email as string);
      },
      async invite(email) {
        const { error } = await client.from(tbl('allowed_emails')).upsert({ email: email.trim().toLowerCase() }, { onConflict: 'email', ignoreDuplicates: true });
        if (error) throw toError(error);
      },
      async revokeInvite(email) {
        const { error } = await client.from(tbl('allowed_emails')).delete().eq('email', email);
        if (error) throw toError(error);
      },
    },
    remote: {
      async upsert(table, row) {
        const { data, error } = await client.from(tbl(table)).upsert(row, { onConflict: 'id' }).select('updated_at').single();
        if (error) throw toError(error);
        return (data as { updated_at: string }).updated_at;
      },
      async fetchSince(table, since, from, to) {
        let q = client.from(tbl(table)).select('*').order('updated_at', { ascending: true }).order('id').range(from, to);
        if (since) q = q.gt('updated_at', since);
        const { data, error } = await q;
        if (error) throw toError(error);
        return (data ?? []) as Record<string, unknown>[];
      },
    },
    storage: {
      async upload(path, blob) {
        const { error } = await client.storage.from(BUCKET).upload(path, blob, { contentType: blob.type || 'image/jpeg', upsert: true, cacheControl: '31536000' });
        if (error) throw toError(error);
        return path;
      },
      async remove(paths) {
        if (!paths.length) return;
        const { error } = await client.storage.from(BUCKET).remove(paths);
        if (error) throw toError(error);
      },
      async signedUrls(paths) {
        if (!paths.length) return {};
        const { data, error } = await client.storage.from(BUCKET).createSignedUrls(paths, SIGNED_URL_TTL);
        if (error) throw toError(error);
        const out: Record<string, string> = {};
        for (const d of data ?? []) if (d.path && d.signedUrl) out[d.path] = d.signedUrl;
        return out;
      },
    },
  };
}
