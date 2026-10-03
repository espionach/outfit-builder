import { useEffect, useState } from 'react';
import { onStorageEvent } from '../storage';
import { useBackup } from '../state/Backup';
import './StorageBanner.css';

type Kind = 'quota' | 'persist';

const PERSIST_NOTE_KEY = 'outfit-builder:persist-note-shown';

const MESSAGES: Record<Kind, string> = {
  quota: 'Storage is full: delete some pieces or export a backup',
  persist:
    'Your browser may clear saved photos if it runs low on space. Export a backup now and then to keep them safe.',
};

// Module-level so the banner survives page changes (it's rendered by each page's header).
let current: Kind | null = null;
const subscribers = new Set<(k: Kind | null) => void>();
const set = (k: Kind | null) => {
  current = k;
  subscribers.forEach((fn) => fn(k));
};

onStorageEvent((event) => {
  if (event.type === 'quota') set('quota');
  else if (event.type === 'persist-denied') {
    // A gentle, one-time note.
    try {
      if (localStorage.getItem(PERSIST_NOTE_KEY)) return;
      localStorage.setItem(PERSIST_NOTE_KEY, '1');
    } catch {
      // Storage blocked: showing it (maybe again later) is fine.
    }
    if (current !== 'quota') set('persist');
  }
});

/** Storage warnings shown under the page header (BUILD_SPEC.md §4.8, §5.4). */
export function StorageBanner() {
  const [kind, setKind] = useState<Kind | null>(current);
  const { exportNow } = useBackup();

  useEffect(() => {
    subscribers.add(setKind);
    return () => void subscribers.delete(setKind);
  }, []);

  if (!kind) return null;

  return (
    <div className="column">
      <div className={`storage-banner storage-banner--${kind}`} role={kind === 'quota' ? 'alert' : 'status'}>
        <p className="storage-banner__text">{MESSAGES[kind]}</p>
        <div className="storage-banner__actions">
          <button type="button" className="pill pill--outline pill--small" onClick={() => void exportNow()}>
            Export backup
          </button>
          <button type="button" className="storage-banner__close" aria-label="Dismiss" onClick={() => set(null)}>
            ×
          </button>
        </div>
      </div>
    </div>
  );
}
