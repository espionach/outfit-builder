import { useState, type ReactNode } from 'react';
import { PlusIcon } from './icons';
import './Chips.css';

type ChipProps = {
  selected: boolean;
  onClick(): void;
  children: ReactNode;
  icon?: ReactNode;
};

/** Toggle chip used for category and folder pickers in pop-ups. */
export function Chip({ selected, onClick, children, icon }: ChipProps) {
  return (
    <button type="button" className="chip" aria-pressed={selected} onClick={onClick}>
      {icon}
      {children}
    </button>
  );
}

type NewChipProps = {
  label: string; // e.g. "New category"
  placeholder: string;
  /** Create the item; return an error message to keep the field open. */
  onCreate(name: string): Promise<string | void>;
};

/** Dashed "+ New …" chip that turns into an inline text field. Enter creates, Esc cancels. */
export function NewChip({ label, placeholder, onCreate }: NewChipProps) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const close = () => {
    setEditing(false);
    setValue('');
    setError(null);
  };

  const submit = async () => {
    const name = value.trim();
    if (!name) return close();
    setBusy(true);
    const problem = await onCreate(name);
    setBusy(false);
    if (problem) setError(problem);
    else close();
  };

  if (!editing) {
    return (
      <button type="button" className="chip chip--new" onClick={() => setEditing(true)}>
        <PlusIcon size={14} />
        {label}
      </button>
    );
  }

  return (
    <span className="chip-new-field">
      <input
        className="chip chip--input"
        autoFocus
        data-own-escape
        value={value}
        placeholder={placeholder}
        aria-label={label}
        aria-invalid={error ? true : undefined}
        maxLength={40}
        disabled={busy}
        onChange={(e) => {
          setValue(e.target.value);
          setError(null);
        }}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            void submit();
          } else if (e.key === 'Escape') {
            // Close just the field, not the whole pop-up.
            e.preventDefault();
            e.stopPropagation();
            close();
          }
        }}
        onBlur={() => {
          if (!value.trim()) close();
        }}
      />
      {error && (
        <span className="chip-new-field__error" role="alert">
          {error}
        </span>
      )}
    </span>
  );
}

/** Case-insensitive duplicate check shared by the "New …" fields and rename pop-ups. */
export function nameTaken(name: string, existing: { name: string; id: string }[], exceptId?: string) {
  const key = name.trim().toLowerCase();
  return existing.some((item) => item.id !== exceptId && item.name.trim().toLowerCase() === key);
}
