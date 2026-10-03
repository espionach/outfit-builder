import { useEffect, useId, useRef, useState } from 'react';
import { processPhoto } from '../lib/images';
import { StorageFullError, type ID } from '../storage';
import { useAppData, type PieceView } from '../state/AppData';
import { Chip, NewChip, nameTaken } from './Chips';
import { Modal, ModalActions } from './Modal';
import { useToast } from './Toast';
import './AddPiecePopup.css';

type Props = {
  files: File[];
  /** Category tab open in the wardrobe, or null for "All". */
  initialCategoryId: ID | null;
  /** Called when the pop-up closes; `lastAdded` is the most recently added piece, if any. */
  onClose(lastAdded: PieceView | null): void;
};

export function AddPiecePopup({ files, initialCategoryId, onClose }: Props) {
  const { categories, addCategory, addPiece } = useAppData();
  const toast = useToast();
  const [index, setIndex] = useState(0);
  const [name, setName] = useState('');
  const [categoryId, setCategoryId] = useState<ID | null>(initialCategoryId);
  const [showCategoryError, setShowCategoryError] = useState(false);
  const [busy, setBusy] = useState(false);
  const lastAdded = useRef<PieceView | null>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const nameId = useId();
  const categoryLabelId = useId();

  const file = files[index];
  const isLast = index === files.length - 1;
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  useEffect(() => {
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [file]);

  const next = () => {
    if (isLast) return onClose(lastAdded.current);
    setIndex((i) => i + 1);
    setName('');
    setShowCategoryError(false);
    // Category carries over: a batch is usually the same kind of piece.
    nameRef.current?.focus();
  };

  const add = async () => {
    if (!categoryId) {
      setShowCategoryError(true);
      return;
    }
    setBusy(true);
    try {
      const photo = await processPhoto(file);
      lastAdded.current = await addPiece({ ...photo, name, categoryId });
      next();
    } catch (err) {
      console.error(err);
      if (err instanceof StorageFullError) {
        toast({ message: err.message, duration: 8000 });
        onClose(lastAdded.current);
      } else {
        toast({ message: "Couldn't read that photo. Try a JPEG or PNG." });
        next();
      }
    } finally {
      setBusy(false);
    }
  };

  const createCategory = async (newName: string) => {
    if (nameTaken(newName, categories)) return 'You already have that category';
    try {
      const category = await addCategory(newName);
      setCategoryId(category.id);
      setShowCategoryError(false);
    } catch (err) {
      return err instanceof StorageFullError ? 'Storage is full' : "Couldn't create that category";
    }
  };

  return (
    <Modal
      title="Add a piece"
      onClose={() => onClose(lastAdded.current)}
      initialFocus={nameRef}
      width={460}
      titleAside={files.length > 1 ? `${index + 1} of ${files.length}` : undefined}
    >
      <form
        className="add-piece"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void add();
        }}
      >
        <div className="add-piece__top">
          <div className="add-piece__preview">{previewUrl && <img src={previewUrl} alt="" />}</div>
          <div className="field">
            <label htmlFor={nameId} className="caps">
              Name <span className="caps__soft">(optional)</span>
            </label>
            <input
              id={nameId}
              ref={nameRef}
              className="text-input"
              type="text"
              value={name}
              maxLength={60}
              placeholder="e.g. Peach cardigan"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
        </div>

        <div className="add-piece__section" role="group" aria-labelledby={categoryLabelId}>
          <div id={categoryLabelId} className="caps">
            Category
          </div>
          <div className="chip-row">
            {categories.map((c) => (
              <Chip
                key={c.id}
                selected={c.id === categoryId}
                onClick={() => {
                  setCategoryId(c.id);
                  setShowCategoryError(false);
                }}
              >
                {c.name}
              </Chip>
            ))}
            <NewChip label="New category" placeholder="Category name" onCreate={createCategory} />
          </div>
          {showCategoryError && (
            <p className="field-error" role="alert">
              Choose a category for this piece
            </p>
          )}
        </div>

        <ModalActions
          start={
            files.length > 1 ? (
              <button type="button" className="link-btn" onClick={next} disabled={busy}>
                Skip
              </button>
            ) : undefined
          }
        >
          <button type="button" className="pill pill--outline" onClick={() => onClose(lastAdded.current)}>
            Cancel
          </button>
          <button type="submit" className="pill pill--primary" disabled={busy}>
            {busy ? 'Adding…' : isLast ? 'Add to wardrobe' : 'Add & next'}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
