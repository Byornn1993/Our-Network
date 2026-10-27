import { createContext, useCallback, useContext, useEffect, useState, type ReactNode } from 'react';
import { loadBackend, type Backend } from '@/lib/backend';
import type { AuthEvent, AuthUser } from '@/lib/backend/types';
import { closeDb, deleteLocalDb, getDb, openDb } from '@/lib/db/schema';
import { flushSync, startSync } from '@/lib/sync/scheduler';

type Membership = 'unknown' | 'member' | 'denied';

interface AuthState {
  backend: Backend | null;
  user: AuthUser | null;
  /** true zolang de backend en de opgeslagen sessie geladen worden. */
  loading: boolean;
  /** true zodra de lokale database van deze gebruiker open is. */
  ready: boolean;
  membership: Membership;
  lastEvent: AuthEvent | null;
  signOut: (opts?: { force?: boolean }) => Promise<{ pending: number }>;
}

const AuthContext = createContext<AuthState | null>(null);

const MEMBER_KEY = (uid: string) => `ournetwork-member-${uid}`;

// localStorage kan ontbreken of een fout gooien (privévenster, artifact-sandbox): dan zonder cache verder.
const store = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k);
    } catch {
      return null;
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v);
    } catch {
      /* geen cache */
    }
  },
  remove: (k: string) => {
    try {
      localStorage.removeItem(k);
    } catch {
      /* geen cache */
    }
  },
};

export function AuthProvider({ children }: { children: ReactNode }) {
  const [backend, setBackend] = useState<Backend | null>(null);
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);
  const [readyFor, setReadyFor] = useState<string | null>(null);
  const [membership, setMembership] = useState<Membership>('unknown');
  const [lastEvent, setLastEvent] = useState<AuthEvent | null>(null);

  useEffect(() => {
    let unsub = () => {};
    void loadBackend().then(async (b) => {
      setBackend(b);
      if (!b) return setLoading(false);
      setUser(await b.auth.getUser());
      setLoading(false);
      unsub = b.auth.onChange((u, e) => {
        setUser((prev) => (prev?.id === u?.id ? prev : u));
        setLastEvent(e);
      });
    });
    return () => unsub();
  }, []);

  const userId = user?.id ?? null;

  // Lidmaatschap van de gedeelde ruimte. Offline vertrouwen we op de laatst gekende status.
  useEffect(() => {
    if (!userId || !backend) return setMembership('unknown');
    const cached = store.get(MEMBER_KEY(userId));
    setMembership(cached === '1' ? 'member' : 'unknown');
    let cancelled = false;
    backend
      .claimMembership()
      .then((ok) => {
        if (cancelled) return;
        store.set(MEMBER_KEY(userId), ok ? '1' : '0');
        setMembership(ok ? 'member' : 'denied');
      })
      .catch(() => {
        // offline of tijdelijke fout: gecachte status blijft gelden
        if (!cancelled && cached !== '1') setMembership(cached === '0' ? 'denied' : 'unknown');
      });
    return () => {
      cancelled = true;
    };
  }, [userId, backend]);

  // Lokale database + sync alleen voor een lid. Zonder sessie wordt er geen data geladen.
  useEffect(() => {
    if (!userId || !backend || membership !== 'member') {
      if (!userId) closeDb();
      setReadyFor(null);
      return;
    }
    const db = openDb(userId);
    let stop: (() => void) | null = null;
    let cancelled = false;
    db.open().then(() => {
      if (cancelled) return;
      setReadyFor(userId);
      stop = startSync(db, backend.remote);
    });
    return () => {
      cancelled = true;
      stop?.();
    };
  }, [userId, backend, membership]);

  const signOut = useCallback(
    async ({ force = false } = {}) => {
      if (!backend || !userId) return { pending: 0 };
      // Eerst proberen alles te versturen; niet-verstuurde wijzigingen gaan nooit stilzwijgend verloren.
      try {
        await flushSync();
      } catch {
        /* offline: hieronder geteld */
      }
      let pending = 0;
      try {
        pending = await getDb().outbox.count();
      } catch {
        pending = 0;
      }
      if (pending > 0 && !force) return { pending };
      await backend.auth.signOut().catch(() => {});
      // Persoonsgegevens niet op het toestel laten staan na uitloggen.
      await deleteLocalDb(userId);
      store.remove(MEMBER_KEY(userId));
      setUser(null);
      return { pending: 0 };
    },
    [backend, userId],
  );

  return (
    <AuthContext.Provider value={{ backend, user, loading, ready: !!userId && readyFor === userId, membership, lastEvent, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const s = useContext(AuthContext);
  if (!s) throw new Error('useAuth buiten AuthProvider');
  return s;
}
