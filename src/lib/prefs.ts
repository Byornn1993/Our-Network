import { useCallback, useSyncExternalStore } from 'react';

// Weergavevoorkeuren per toestel (geen persoonsgegevens): thema, kaartfilters, tijdlijnweergave.

export interface Prefs {
  theme: 'dark' | 'light' | 'auto';
  mapHiddenCategories: string[];
  mapShowRelations: boolean;
  mapShowLabels: boolean;
  storyShowChanges: boolean;
  storyDefaultWho: 'all' | 'bjorn' | 'stephanie' | 'common';
  personsView: 'list' | 'grid';
  personsSort: 'name' | 'category' | 'recent' | 'met';
}

const DEFAULTS: Prefs = {
  theme: 'dark',
  mapHiddenCategories: [],
  mapShowRelations: false,
  mapShowLabels: true,
  storyShowChanges: true,
  storyDefaultWho: 'all',
  personsView: 'list',
  personsSort: 'name',
};

const KEY = 'ournetwork-prefs';
const listeners = new Set<() => void>();

function read(): Prefs {
  try {
    return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) ?? '{}') as Partial<Prefs>), theme: (localStorage.getItem('ournetwork-theme') as Prefs['theme']) ?? 'dark' };
  } catch {
    return DEFAULTS;
  }
}

let state = read();

export function applyTheme(theme: Prefs['theme']) {
  const t = theme === 'auto' ? (matchMedia('(prefers-color-scheme: light)').matches ? 'light' : 'dark') : theme;
  document.documentElement.dataset.theme = t;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t === 'light' ? '#F6F1E8' : '#101418');
}

export function setPref<K extends keyof Prefs>(key: K, value: Prefs[K]) {
  state = { ...state, [key]: value };
  try {
    if (key === 'theme') {
      localStorage.setItem('ournetwork-theme', value as string);
      applyTheme(value as Prefs['theme']);
    }
    const { theme: _t, ...rest } = state;
    localStorage.setItem(KEY, JSON.stringify(rest));
  } catch {
    /* privémodus: enkel in het geheugen */
  }
  listeners.forEach((l) => l());
}

export function usePref<K extends keyof Prefs>(key: K): [Prefs[K], (v: Prefs[K]) => void] {
  const value = useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    () => state[key],
  );
  const set = useCallback((v: Prefs[K]) => setPref(key, v), [key]);
  return [value, set];
}

if (typeof window !== 'undefined') {
  matchMedia('(prefers-color-scheme: light)').addEventListener?.('change', () => state.theme === 'auto' && applyTheme('auto'));
}
