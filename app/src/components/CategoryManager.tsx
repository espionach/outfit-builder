import { useState } from 'react';
import type { Category, ID } from '../storage';
import { useAppData } from '../state/AppData';
import { ActionMenu } from './ActionMenu';
import { Chip, nameTaken } from './Chips';
import { Modal, ModalActions } from './Modal';
import { NamePopup } from './NamePopup';
import { useToast } from './Toast';

type Props = {
  category: Category;
  anchor: HTMLElement;
  onDeleted(id: ID): void;
  onClose(): void;
};

/** Press-and-hold menu for a category tab, plus its Rename and Delete pop-ups. */
export function CategoryManager({ category, anchor, onDeleted, onClose }: Props) {
  const { categories, renameCategory } = useAppData();
  const [mode, setMode] = useState<'menu' | 'rename' | 'delete'>('menu');

  if (mode === 'menu') {
    return (
      <ActionMenu
        anchor={anchor}
        label={`${category.name} options`}
        onClose={onClose}
        items={[
          { label: 'Rename', onSelect: () => setMode('rename') },
          {
            label: 'Delete',
            danger: true,
            // Pieces always need a category to live in.
            disabled: categories.length <= 1,
            onSelect: () => setMode('delete'),
          },
        ]}
      />
    );
  }

  if (mode === 'rename') {
    return (
      <NamePopup
        title="Rename category"
        label="Category name"
        initialValue={category.name}
        confirmLabel="Rename"
        onClose={onClose}
        onSubmit={async (name) => {
          if (nameTaken(name, categories, category.id)) return 'You already have that category';
          try {
            await renameCategory(category.id, name);
          } catch {
            return "Couldn't rename it. Try again.";
          }
        }}
      />
    );
  }

  return <DeleteCategoryPopup category={category} onDeleted={onDeleted} onClose={onClose} />;
}

function DeleteCategoryPopup({ category, onDeleted, onClose }: Omit<Props, 'anchor'>) {
  const { categories, pieces, deleteCategory } = useAppData();
  const toast = useToast();
  const count = pieces.filter((p) => p.categoryId === category.id).length;
  const others = categories.filter((c) => c.id !== category.id);
  const [moveTo, setMoveTo] = useState<ID | null>(null);
  const [busy, setBusy] = useState(false);

  const confirm = async () => {
    setBusy(true);
    try {
      // Soft-deleted pieces waiting on an undo move too, so pass a target even when count is 0.
      await deleteCategory(category.id, moveTo ?? others[0]?.id ?? null);
      onDeleted(category.id);
      const target = others.find((c) => c.id === moveTo);
      toast({
        message: target ? (
          <>
            Moved {count} {count === 1 ? 'piece' : 'pieces'} to <em>{target.name}</em>
          </>
        ) : (
          'Category deleted'
        ),
      });
      onClose();
    } catch {
      toast({ message: "Couldn't delete that category. Try again." });
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete ${category.name}?`} onClose={onClose} width={440}>
      {count > 0 ? (
        <div className="field" style={{ gap: 10 }} role="group" aria-labelledby="move-to-label">
          <div id="move-to-label" className="caps">
            Move its {count} {count === 1 ? 'piece' : 'pieces'} to
          </div>
          <div className="chip-row">
            {others.map((c) => (
              <Chip key={c.id} selected={moveTo === c.id} onClick={() => setMoveTo(c.id)}>
                {c.name}
              </Chip>
            ))}
          </div>
        </div>
      ) : (
        <p style={{ margin: 0, color: 'var(--muted)' }}>This category is empty.</p>
      )}
      <ModalActions>
        <button type="button" className="pill pill--outline" onClick={onClose}>
          Cancel
        </button>
        <button
          type="button"
          className="pill pill--primary"
          disabled={busy || (count > 0 && !moveTo)}
          onClick={() => void confirm()}
        >
          Delete category
        </button>
      </ModalActions>
    </Modal>
  );
}
