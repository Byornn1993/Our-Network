import type { RemoteApi } from '@/lib/sync/engine';

export interface AuthUser {
  id: string;
  email: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER';

export interface Member {
  user_id: string;
  email: string;
  created_at: string;
}

/**
 * Alles wat de app van de backend nodig heeft. In productie: Supabase.
 * Voor ontwikkeling en e2e-tests bestaat een lokale nabootsing (`npm run dev:local`), die NOOIT
 * in de productiebuild terechtkomt.
 */
export interface Backend {
  kind: 'supabase' | 'local';
  auth: {
    getUser(): Promise<AuthUser | null>;
    onChange(cb: (user: AuthUser | null, event: AuthEvent) => void): () => void;
    signIn(email: string, password: string): Promise<void>;
    signOut(): Promise<void>;
    sendResetLink(email: string, redirectTo: string): Promise<void>;
    updatePassword(password: string): Promise<void>;
  };
  /** Maakt de ingelogde gebruiker lid van de gedeelde ruimte als dat mag. */
  claimMembership(): Promise<boolean>;
  members: {
    list(): Promise<Member[]>;
    invites(): Promise<string[]>;
    invite(email: string): Promise<void>;
    revokeInvite(email: string): Promise<void>;
  };
  remote: RemoteApi;
  storage: {
    upload(path: string, blob: Blob): Promise<void>;
    remove(paths: string[]): Promise<void>;
    /** Kortlevende URL's om privébestanden te tonen. */
    signedUrls(paths: string[]): Promise<Record<string, string>>;
  };
}
