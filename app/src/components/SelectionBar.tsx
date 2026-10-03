import { TrashIcon } from './icons';
import './SelectionBar.css';

type Props = {
  count: number;
  onCancel(): void;
  onDelete(): void;
  /** 'anchored' sits above its positioned parent (the wardrobe card); 'floating' is fixed to the viewport bottom. */
  placement: 'anchored' | 'floating';
};

/** Dark pill that pops up in selection mode: "N selected · Cancel · Delete all". */
export function SelectionBar({ count, onCancel, onDelete, placement }: Props) {
  return (
    <div role="toolbar" aria-label="Selection actions" className={`selection-bar selection-bar--${placement}`}>
      <div className="selection-bar__count" aria-live="polite">
        {count} selected
      </div>
      <div className="selection-bar__actions">
        <button type="button" className="selection-bar__cancel" onClick={onCancel}>
          Cancel
        </button>
        <button type="button" className="selection-bar__delete" onClick={onDelete} disabled={count === 0}>
          <TrashIcon />
          Delete all
        </button>
      </div>
    </div>
  );
}
