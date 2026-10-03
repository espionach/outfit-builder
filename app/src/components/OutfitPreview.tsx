import { useId, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import type { ID } from '../storage';
import { useAppData, type OutfitView } from '../state/AppData';
import { useDraft } from '../state/Draft';
import { Chip } from './Chips';
import { FolderIcon } from './icons';
import { Modal, ModalActions } from './Modal';
import { formatDate } from './OutfitCard';
import { useToast } from './Toast';
import './OutfitPreview.css';

type Props = {
  outfit: OutfitView;
  onClose(): void;
};

/** Larger preview of a saved outfit: rename, move between folders, load into the builder. */
export function OutfitPreview({ outfit, onClose }: Props) {
  const { folders, pieces, updateOutfit } = useAppData();
  const { isDirty, replace } = useDraft();
  const toast = useToast();
  const navigate = useNavigate();
  const [name, setName] = useState(outfit.name);
  const [confirmLoad, setConfirmLoad] = useState(false);
  const loadRef = useRef<HTMLButtonElement>(null);
  const nameId = useId();
  const foldersLabelId = useId();

  const commitName = async (value: string) => {
    const next = value.trim();
    if (!next) {
      setName(outfit.name);
      return;
    }
    if (next === outfit.name) return;
    try {
      await updateOutfit(outfit.id, { name: next });
    } catch {
      toast({ message: "Couldn't rename the outfit. Try again." });
      setName(outfit.name);
    }
  };

  const moveTo = async (folderId: ID | null) => {
    try {
      await updateOutfit(outfit.id, { folderId });
    } catch {
      toast({ message: "Couldn't move the outfit. Try again." });
    }
  };

  const load = () => {
    const ids = new Set(pieces.map((p) => p.id));
    const layout = outfit.layout.filter((p) => ids.has(p.pieceId));
    const missing = outfit.layout.length - layout.length;
    replace(layout);
    onClose();
    navigate('/');
    if (missing > 0) {
      toast({
        message:
          missing === 1
            ? '1 piece is no longer in your wardrobe, so it was left out'
            : `${missing} pieces are no longer in your wardrobe, so they were left out`,
        duration: 6000,
      });
    }
  };

  return (
    <>
      <Modal title={outfit.name} onClose={onClose} width={460} className="outfit-preview" initialFocus={loadRef}>
        <div className="outfit-preview__image">
          <img src={outfit.snapshotUrl} alt={`${outfit.name} outfit`} />
        </div>
        <p className="outfit-preview__date">Saved {formatDate(outfit.createdAt)}</p>

        <div className="field">
          <label htmlFor={nameId} className="caps">
            Outfit name
          </label>
          <input
            id={nameId}
            className="text-input"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            onBlur={(e) => void commitName(e.currentTarget.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                e.currentTarget.blur();
              }
            }}
          />
        </div>

        <div className="field" style={{ gap: 10 }} role="group" aria-labelledby={foldersLabelId}>
          <div id={foldersLabelId} className="caps">
            Folder
          </div>
          {folders.length === 0 ? (
            <p className="outfit-preview__hint">No folders yet. Create one from the Saved outfits page.</p>
          ) : (
            <div className="chip-row">
              {folders.map((f) => (
                <Chip
                  key={f.id}
                  selected={outfit.folderId === f.id}
                  onClick={() => void moveTo(outfit.folderId === f.id ? null : f.id)}
                  icon={<FolderIcon color={f.color} />}
                >
                  {f.name}
                </Chip>
              ))}
            </div>
          )}
        </div>

        <ModalActions>
          <button type="button" className="pill pill--outline" onClick={onClose}>
            Close
          </button>
          <button
            ref={loadRef}
            type="button"
            className="pill pill--primary"
            onClick={() => (isDirty ? setConfirmLoad(true) : load())}
          >
            Load into builder
          </button>
        </ModalActions>
      </Modal>

      {confirmLoad && (
        <Modal title="Replace your canvas?" onClose={() => setConfirmLoad(false)} width={400}>
          <p className="outfit-preview__hint">
            The outfit on your canvas hasn't been saved. Loading <strong>{outfit.name}</strong> will replace it.
          </p>
          <ModalActions>
            <button type="button" className="pill pill--outline" onClick={() => setConfirmLoad(false)}>
              Keep editing
            </button>
            <button type="button" className="pill pill--primary" onClick={load}>
              Replace
            </button>
          </ModalActions>
        </Modal>
      )}
    </>
  );
}
