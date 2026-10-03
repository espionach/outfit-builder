import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, Navigate, useNavigate, useParams } from 'react-router-dom';
import type { Folder, ID } from '../storage';
import { useAppData } from '../state/AppData';
import { FolderManager } from '../components/FolderManager';
import { ChevronLeft, FolderIcon, PlusIcon } from '../components/icons';
import { NamePopup } from '../components/NamePopup';
import { nameTaken } from '../components/Chips';
import { OutfitCard } from '../components/OutfitCard';
import { OutfitPreview } from '../components/OutfitPreview';
import { PageHeader } from '../components/PageHeader';
import { useLongPress } from '../lib/useLongPress';
import { useSelection } from '../lib/useSelection';
import { SelectionBar } from '../components/SelectionBar';
import { useToast } from '../components/Toast';
import { HOLD_HINT_MANAGE, isMenuKey } from '../lib/a11y';
import './SavedPage.css';

export function SavedPage() {
  const { folderId } = useParams();
  const { folders, outfits, addFolder, deleteOutfits, restoreOutfits, purgeOutfits } = useAppData();
  const toast = useToast();
  const selection = useSelection<ID>();
  const navigate = useNavigate();
  const [openId, setOpenId] = useState<ID | null>(null);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [managing, setManaging] = useState<{ folder: Folder; anchor: HTMLElement } | null>(null);

  const folder = folderId ? folders.find((f) => f.id === folderId) : undefined;
  const shown = useMemo(
    () => (folderId ? outfits.filter((o) => o.folderId === folderId) : outfits),
    [outfits, folderId],
  );
  const counts = useMemo(() => {
    const map = new Map<ID, number>();
    outfits.forEach((o) => o.folderId && map.set(o.folderId, (map.get(o.folderId) ?? 0) + 1));
    return map;
  }, [outfits]);
  // Look the open outfit up live so renames and folder moves show immediately.
  const open = outfits.find((o) => o.id === openId);

  // Leaving a folder view (or opening another) ends selection.
  const { exit } = selection;
  useEffect(() => exit(), [folderId, exit]);

  const deleteSelected = useCallback(async () => {
    const ids = [...(selection.selected ?? [])];
    if (!ids.length) return;
    try {
      await deleteOutfits(ids);
    } catch {
      toast({ message: "Couldn't delete those outfits. Try again." });
      return;
    }
    selection.exit();
    toast({
      message: `${ids.length} ${ids.length === 1 ? 'outfit' : 'outfits'} deleted`,
      actionLabel: 'Undo',
      onAction: () => void restoreOutfits(ids).catch(() => toast({ message: "Couldn't undo. Try again." })),
      onDismiss: () => void purgeOutfits(ids).catch((err) => console.error('Purge failed', err)),
    });
  }, [selection, deleteOutfits, restoreOutfits, purgeOutfits, toast]);

  // A folder that was deleted (or a stale link) falls back to all outfits.
  if (folderId && !folder) return <Navigate to="/saved" replace />;

  return (
    <>
      <PageHeader
        title={folder ? folder.name : 'Saved outfits'}
        left={
          folder ? (
            <Link to="/saved" className="pill pill--outline saved__back">
              <ChevronLeft />
              All outfits
            </Link>
          ) : (
            <Link to="/" className="pill pill--outline saved__back">
              <ChevronLeft />
              Back to builder
            </Link>
          )
        }
      />
      <main className="column saved">
        {!folder && (
          <section className="saved__section" aria-labelledby="folders-heading">
            <h2 id="folders-heading" className="caps saved__heading">
              Folders
            </h2>
            <div className="folder-grid">
              {folders.map((f) => (
                <FolderTile
                  key={f.id}
                  folder={f}
                  count={counts.get(f.id) ?? 0}
                  onOpen={() => navigate(`/saved/folder/${f.id}`)}
                  onManage={(anchor) => setManaging({ folder: f, anchor })}
                />
              ))}
              <button type="button" className="folder-tile folder-tile--new" onClick={() => setCreatingFolder(true)}>
                <PlusIcon size={18} />
                New folder
              </button>
            </div>
          </section>
        )}

        <section className="saved__section" aria-labelledby="outfits-heading">
          <div className="saved__row">
            <h2 id="outfits-heading" className="caps saved__heading">
              {folder ? 'Outfits' : 'All outfits'} · {shown.length}
            </h2>
            {shown.length > 0 && (
              <div className="saved__hint">
                {selection.active ? 'Tap more outfits to add them' : 'Press and hold an outfit to select'}
              </div>
            )}
          </div>

          {shown.length === 0 ? (
            <div className="saved__empty">
              {folder ? (
                <>
                  <p className="saved__empty-title">Nothing in {folder.name} yet</p>
                  <p className="saved__empty-hint">Choose {folder.name} when you save an outfit</p>
                </>
              ) : (
                <>
                  <p className="saved__empty-title">No saved outfits yet</p>
                  <Link to="/" className="pill pill--primary">
                    Build an outfit
                  </Link>
                </>
              )}
            </div>
          ) : (
            <div className="outfit-grid">
              {shown.map((o) => (
                <OutfitCard
                  key={o.id}
                  outfit={o}
                  onOpen={() => setOpenId(o.id)}
                  selecting={selection.active}
                  selected={!!selection.selected?.has(o.id)}
                  onHold={() => selection.start(o.id)}
                  onToggle={() => selection.toggle(o.id)}
                />
              ))}
            </div>
          )}
        </section>
      </main>

      {selection.selected && (
        <SelectionBar
          placement="floating"
          count={selection.selected.size}
          onCancel={selection.exit}
          onDelete={() => void deleteSelected()}
        />
      )}

      {open && <OutfitPreview outfit={open} onClose={() => setOpenId(null)} />}

      {creatingFolder && (
        <NamePopup
          title="New folder"
          label="Folder name"
          placeholder="e.g. Weekend"
          confirmLabel="Create folder"
          onClose={() => setCreatingFolder(false)}
          onSubmit={async (name) => {
            if (nameTaken(name, folders)) return 'You already have that folder';
            try {
              await addFolder(name);
            } catch {
              return "Couldn't create that folder. Try again.";
            }
          }}
        />
      )}

      {managing && (
        <FolderManager
          folder={managing.folder}
          anchor={managing.anchor}
          onDeleted={() => {}}
          onClose={() => setManaging(null)}
        />
      )}
    </>
  );
}

type FolderTileProps = {
  folder: Folder;
  count: number;
  onOpen(): void;
  onManage(anchor: HTMLElement): void;
};

function FolderTile({ folder, count, onOpen, onManage }: FolderTileProps) {
  const press = useLongPress<HTMLButtonElement>({ onHold: onManage });
  return (
    <button
      type="button"
      className="folder-tile"
      {...press}
      onClick={onOpen}
      onContextMenu={(e) => {
        e.preventDefault();
        onManage(e.currentTarget);
      }}
      onKeyDown={(e) => {
        if (isMenuKey(e)) {
          e.preventDefault();
          onManage(e.currentTarget);
        }
      }}
      aria-description={HOLD_HINT_MANAGE}
    >
      <span className="folder-tile__icon">
        <FolderIcon size={22} color={folder.color} />
      </span>
      <span className="folder-tile__text">
        <span className="folder-tile__name">{folder.name}</span>
        <span className="folder-tile__count">
          {count} {count === 1 ? 'outfit' : 'outfits'}
        </span>
      </span>
    </button>
  );
}
