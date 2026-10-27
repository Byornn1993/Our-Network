import type { RemoteApi } from '@/lib/sync/engine';

export interface AuthUser {
  id: string;
  email: string;
  /** Weergavenaam, als de backend die kent (artifact-modus). */
  name?: string;
}

export type AuthEvent = 'SIGNED_IN' | 'SIGNED_OUT' | 'PASSWORD_RECOVERY' | 'OTHER';

export interface Member {
  user_id: string;
  email: string;
  created_at: string;
}

/**
 * Alles wat de app van de backend nodig heeft. In productie: Supabase of de claude.ai-Artifact.
 * Voor ontwikkeling en e2e-tests bestaat een lokale nabootsing (`npm run dev:local`), die NOOIT
 * in een productiebuild terechtkomt.
 */
export interface Backend {
  kind: 'supabase' | 'local' | 'artifact';
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
    /** Bewaart een bestand en geeft de sleutel terug die in de database komt (pad of asset-id). */
    upload(path: string, blob: Blob): Promise<string>;
    remove(paths: string[]): Promise<void>;
    /** Kortlevende URL's om privébestanden te tonen. */
    signedUrls(paths: string[]): Promise<Record<string, string>>;
  };
  /** Wat deze kijker mag; null = onbekend (laat het platform beslissen bij de eerste schrijfactie). */
  permissions?: {
    canWrite: boolean | null;
    canUpload: boolean;
  };
  /** Een gegenereerd bestand aan de kijker aanbieden (artifact: via `downloads`). */
  saveFile?(filename: string, data: string): Promise<void>;
}
