import { useEffect, useId, useMemo, useRef, useState } from 'react';
import { StorageFullError, type ID, type PlacedPiece } from '../storage';
import { useAppData } from '../state/AppData';
import { renderSnapshot } from '../lib/snapshot';
import { Chip, NewChip, nameTaken } from './Chips';
import { FolderIcon } from './icons';
import { Modal, ModalActions } from './Modal';
import { useToast } from './Toast';
import './SaveOutfitPopup.css';

type Props = {
  layout: PlacedPiece[];
  onSaved(): void;
  onClose(): void;
};

/** Next unused "Outfit N" name. */
function defaultName(existing: { name: string }[]) {
  const taken = new Set(existing.map((o) => o.name.trim().toLowerCase()));
  let n = existing.length + 1;
  while (taken.has(`outfit ${n}`)) n++;
  return `Outfit ${n}`;
}

export function SaveOutfitPopup({ layout, onSaved, onClose }: Props) {
  const { pieces, outfits, folders, addFolder, addOutfit } = useAppData();
  const toast = useToast();
  const [name, setName] = useState(() => defaultName(outfits));
  const [folderId, setFolderId] = useState<ID | null>(null);
  const [nameError, setNameError] = useState(false);
  const [busy, setBusy] = useState(false);
  const [snapshot, setSnapshot] = useState<{ blob: Blob; url: string } | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const foldersLabelId = useId();

  const images = useMemo(() => new Map(pieces.map((p) => [p.id, p.image])), [pieces]);

  useEffect(() => {
    let cancelled = false;
    let url: string | null = null;
    renderSnapshot(layout, images)
      .then((blob) => {
        if (cancelled) return;
        url = URL.createObjectURL(blob);
        setSnapshot({ blob, url });
      })
      .catch((err) => console.error('Snapshot failed', err));
    return () => {
      cancelled = true;
      if (url) URL.revokeObjectURL(url);
    };
  }, [layout, images]);

  const save = async () => {
    if (!name.trim()) {
      setNameError(true);
      nameRef.current?.focus();
      return;
    }
    setBusy(true);
    try {
      const blob = snapshot?.blob ?? (await renderSnapshot(layout, images));
      await addOutfit({ name, folderId, layout, snapshot: blob });
      const folder = folders.find((f) => f.id === folderId);
      toast({
        message: folder ? (
          <>
            Saved to <em>{folder.name}</em>
          </>
        ) : (
          'Outfit saved'
        ),
      });
      onSaved();
      onClose();
    } catch (err) {
      console.error(err);
      toast({
        message: err instanceof StorageFullError ? err.message : "Couldn't save the outfit. Try again.",
        duration: 8000,
      });
      setBusy(false);
    }
  };

  const createFolder = async (folderName: string) => {
    if (nameTaken(folderName, folders)) return 'You already have that folder';
    try {
      const folder = await addFolder(folderName);
      setFolderId(folder.id);
    } catch (err) {
      return err instanceof StorageFullError ? 'Storage is full' : "Couldn't create that folder";
    }
  };

  return (
    <Modal title="Save this outfit" onClose={onClose} initialFocus={nameRef}>
      <form
        className="save-outfit"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void save();
        }}
      >
        <div className="save-outfit__top">
          <div className="save-outfit__thumb">{snapshot && <img src={snapshot.url} alt="Outfit preview" />}</div>
          <div className="field">
            <label htmlFor={nameId} className="caps">
              Outfit name
            </label>
            <input
              id={nameId}
              ref={nameRef}
              className="text-input"
              type="text"
              value={name}
              maxLength={60}
              required
              placeholder="e.g. Sunday brunch"
              aria-invalid={nameError || undefined}
              aria-describedby={nameError ? `${nameId}-error` : undefined}
              onChange={(e) => {
                setName(e.target.value);
                setNameError(false);
              }}
            />
            {nameError && (
              <p id={`${nameId}-error`} className="field-error" role="alert">
                Give your outfit a name
              </p>
            )}
          </div>
        </div>

        <div className="save-outfit__section" role="group" aria-labelledby={foldersLabelId}>
          <div id={foldersLabelId} className="caps">
            Add to folder <span className="caps__soft">(optional)</span>
          </div>
          <div className="chip-row">
            {folders.map((f) => (
              <Chip
                key={f.id}
                selected={f.id === folderId}
                // Tap again to go back to no folder.
                onClick={() => setFolderId((cur) => (cur === f.id ? null : f.id))}
                icon={<FolderIcon color={f.color} />}
              >
                {f.name}
              </Chip>
            ))}
            <NewChip label="New folder" placeholder="Folder name" onCreate={createFolder} />
          </div>
        </div>

        <ModalActions>
          <button type="button" className="pill pill--outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pill pill--primary" disabled={busy}>
            {busy ? 'Saving…' : 'Save outfit'}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
