import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import '@fontsource-variable/inter';
import './index.css';
import App from './App';

// Vraag persistente opslag aan, zodat de browser de lokale data (en niet-verstuurde wijzigingen) niet zomaar opruimt.
if (navigator.storage?.persist) void navigator.storage.persist().catch(() => {});

/**
 * In een Artifact kan IndexedDB ontbreken (bv. privévenster of geblokkeerde site-data). De lokale kopie is daar
 * enkel een cache — de gegevens staan in de Artifact-database — dus dan werken we met een cache in het geheugen.
 */
async function ensureLocalStorage(): Promise<void> {
  if (import.meta.env.MODE !== 'artifact') return;
  const ok = await new Promise<boolean>((resolve) => {
    try {
      const req = indexedDB.open('ournetwork-probe');
      req.onsuccess = () => {
        req.result.close();
        resolve(true);
      };
      req.onerror = () => resolve(false);
    } catch {
      resolve(false);
    }
  });
  if (ok) return;
  const [{ default: Dexie }, fake] = await Promise.all([import('dexie'), import('fake-indexeddb')]);
  Dexie.dependencies.indexedDB = fake.indexedDB;
  Dexie.dependencies.IDBKeyRange = fake.IDBKeyRange;
}

void ensureLocalStorage().then(() =>
  createRoot(document.getElementById('root')!).render(
    <StrictMode>
      <App />
    </StrictMode>,
  ),
);
