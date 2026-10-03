import { useState } from 'react';
import { useBackup } from '../state/Backup';
import { ActionMenu } from './ActionMenu';
import { MoreIcon } from './icons';

/** The small ⋯ menu in the page header: backup export / import. */
export function HeaderMenu() {
  const { exportNow, startImport } = useBackup();
  const [anchor, setAnchor] = useState<HTMLElement | null>(null);

  return (
    <>
      <button
        type="button"
        className="icon-btn header-menu"
        aria-label="More options"
        aria-haspopup="menu"
        aria-expanded={!!anchor}
        title="Backup"
        onClick={(e) => setAnchor(anchor ? null : e.currentTarget)}
      >
        <MoreIcon />
      </button>
      {anchor && (
        <ActionMenu
          anchor={anchor}
          label="More options"
          onClose={() => setAnchor(null)}
          items={[
            {
              label: 'Export backup',
              onSelect: () => {
                setAnchor(null);
                void exportNow();
              },
            },
            {
              label: 'Import backup',
              onSelect: () => {
                setAnchor(null);
                startImport();
              },
            },
          ]}
        />
      )}
    </>
  );
}
