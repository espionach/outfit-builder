import { createContext, useCallback, useContext, useMemo, useRef, useState, type ReactNode } from 'react';
import * as storage from '../storage';
import type { ParsedBackup } from '../storage';
import { Modal, ModalActions } from '../components/Modal';
import { useToast } from '../components/Toast';
import { useAppData } from './AppData';
import { useDraft } from './Draft';

type BackupActions = {
  exportNow(): Promise<void>;
  startImport(): void;
};

const Ctx = createContext<BackupActions | null>(null);

export function useBackup() {
  const value = useContext(Ctx);
  if (!value) throw new Error('useBackup must be used inside <BackupProvider>');
  return value;
}

const fileDate = (ms: number) => new Date(ms).toISOString().slice(0, 10);
const longDate = (ms: number) =>
  new Date(ms).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? '' : 's'}`;

/** Export / import backups (BUILD_SPEC.md §5.4), shared by the header menu and the storage banner. */
export function BackupProvider({ children }: { children: ReactNode }) {
  const { reload } = useAppData();
  const { discardPending } = useDraft();
  const toast = useToast();
  const input = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<ParsedBackup | null>(null);
  const [busy, setBusy] = useState(false);

  const exportNow = useCallback(async () => {
    try {
      const blob = await storage.exportBackup();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `outfit-builder-backup-${fileDate(Date.now())}.zip`;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 10_000);
      toast({ message: 'Backup exported' });
    } catch (err) {
      console.error(err);
      toast({ message: "Couldn't export a backup. Try again." });
    }
  }, [toast]);

  const onFile = async (file: File) => {
    try {
      setPending(await storage.readBackup(file));
    } catch (err) {
      toast({
        message: err instanceof storage.BackupError ? err.message : "Couldn't read that backup.",
        duration: 6000,
      });
    }
  };

  const confirmImport = async () => {
    if (!pending) return;
    setBusy(true);
    try {
      discardPending();
      await storage.importBackup(pending);
      await reload();
      toast({ message: 'Backup restored' });
      setPending(null);
    } catch (err) {
      console.error(err);
      toast({
        message: err instanceof storage.StorageFullError ? err.message : "Couldn't restore the backup. Try again.",
        duration: 8000,
      });
    } finally {
      setBusy(false);
    }
  };

  const value = useMemo(() => ({ exportNow, startImport: () => input.current?.click() }), [exportNow]);

  return (
    <Ctx.Provider value={value}>
      {children}
      <input
        ref={input}
        type="file"
        accept=".zip,application/zip"
        hidden
        onChange={(e) => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void onFile(file);
        }}
      />
      {pending && (
        <Modal title="Restore this backup?" onClose={() => !busy && setPending(null)} width={420}>
          <p className="confirm-text">
            This replaces everything in the app with the backup from {longDate(pending.summary.exportedAt)}:{' '}
            {plural(pending.summary.pieces, 'piece')} and {plural(pending.summary.outfits, 'outfit')}.
          </p>
          <ModalActions>
            <button type="button" className="pill pill--outline" onClick={() => setPending(null)} disabled={busy}>
              Cancel
            </button>
            <button type="button" className="pill pill--primary" onClick={() => void confirmImport()} disabled={busy}>
              {busy ? 'Restoring…' : 'Replace'}
            </button>
          </ModalActions>
        </Modal>
      )}
    </Ctx.Provider>
  );
}
