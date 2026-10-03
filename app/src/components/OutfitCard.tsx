import type { OutfitView } from '../state/AppData';
import { useLongPress } from '../lib/useLongPress';
import { CheckIcon } from './icons';
import { HOLD_HINT_SELECT, isMenuKey } from '../lib/a11y';
import './OutfitCard.css';

export function formatDate(ms: number) {
  const d = new Date(ms);
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return d.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: sameYear ? undefined : 'numeric' });
}

type Props = {
  outfit: OutfitView;
  onOpen(outfit: OutfitView): void;
  /** Selection mode is on: taps toggle instead of opening. */
  selecting: boolean;
  selected: boolean;
  onHold(outfit: OutfitView): void;
  onToggle(outfit: OutfitView): void;
};

export function OutfitCard({ outfit, onOpen, selecting, selected, onHold, onToggle }: Props) {
  const press = useLongPress<HTMLButtonElement>({ onHold: () => onHold(outfit), disabled: selecting });
  const date = formatDate(outfit.createdAt);

  return (
    <button
      type="button"
      className={`outfit-card ${selected ? 'outfit-card--selected' : ''}`}
      aria-label={`${outfit.name}, ${date}`}
      aria-pressed={selecting ? selected : undefined}
      {...press}
      onContextMenu={(e) => {
        // Right-click / the context-menu key also start selection.
        e.preventDefault();
        if (!selecting) onHold(outfit);
      }}
      onKeyDown={(e) => {
        if (isMenuKey(e) && !selecting) {
          e.preventDefault();
          onHold(outfit);
        }
      }}
      aria-description={selecting ? undefined : HOLD_HINT_SELECT}
      onClick={() => (selecting ? onToggle(outfit) : onOpen(outfit))}
    >
      <div className="outfit-card__image">
        <img src={outfit.snapshotUrl} alt="" draggable={false} />
      </div>
      <div className="outfit-card__meta">
        <div className="outfit-card__name">{outfit.name}</div>
        <div className="outfit-card__date">{date}</div>
      </div>
      {selecting &&
        (selected ? (
          <span className="outfit-card__check" aria-hidden="true">
            <CheckIcon />
          </span>
        ) : (
          <span className="outfit-card__circle" aria-hidden="true" />
        ))}
    </button>
  );
}
