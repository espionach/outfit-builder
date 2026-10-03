import { useState } from 'react';
import type { Folder, ID } from '../storage';
import { useAppData } from '../state/AppData';
import { ActionMenu } from './ActionMenu';
import { nameTaken } from './Chips';
import { Modal, ModalActions } from './Modal';
import { NamePopup } from './NamePopup';
import { useToast } from './Toast';

type Props = {
  folder: Folder;
  anchor: HTMLElement;
  onDeleted(id: ID): void;
  onClose(): void;
};

/** Press-and-hold menu for a folder tile, plus its Rename and Delete pop-ups. */
export function FolderManager({ folder, anchor, onDeleted, onClose }: Props) {
  const { folders, outfits, renameFolder, deleteFolder } = useAppData();
  const toast = useToast();
  const [mode, setMode] = useState<'menu' | 'rename' | 'delete'>('menu');
  const [busy, setBusy] = useState(false);
  const count = outfits.filter((o) => o.folderId === folder.id).length;

  if (mode === 'menu') {
    return (
      <ActionMenu
        anchor={anchor}
        label={`${folder.name} options`}
        onClose={onClose}
        items={[
          { label: 'Rename', onSelect: () => setMode('rename') },
          { label: 'Delete', danger: true, onSelect: () => setMode('delete') },
        ]}
      />
    );
  }

  if (mode === 'rename') {
    return (
      <NamePopup
        title="Rename folder"
        label="Folder name"
        initialValue={folder.name}
        confirmLabel="Rename"
        onClose={onClose}
        onSubmit={async (name) => {
          if (nameTaken(name, folders, folder.id)) return 'You already have that folder';
          try {
            await renameFolder(folder.id, name);
          } catch {
            return "Couldn't rename it. Try again.";
          }
        }}
      />
    );
  }

  const confirm = async () => {
    setBusy(true);
    try {
      await deleteFolder(folder.id);
      onDeleted(folder.id);
      toast({ message: 'Folder deleted' });
      onClose();
    } catch {
      toast({ message: "Couldn't delete that folder. Try again." });
      setBusy(false);
    }
  };

  return (
    <Modal title={`Delete ${folder.name}?`} onClose={onClose} width={400}>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--muted)' }}>
        {count === 0
          ? 'This folder is empty.'
          : `Its ${count} ${count === 1 ? 'outfit stays' : 'outfits stay'} in All outfits. Only the folder goes away.`}
      </p>
      <ModalActions>
        <button type="button" className="pill pill--outline" onClick={onClose}>
          Cancel
        </button>
        <button type="button" className="pill pill--primary" disabled={busy} onClick={() => void confirm()}>
          Delete folder
        </button>
      </ModalActions>
    </Modal>
  );
}
