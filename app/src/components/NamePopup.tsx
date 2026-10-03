import { useId, useRef, useState } from 'react';
import { Modal, ModalActions } from './Modal';

type Props = {
  title: string;
  label: string;
  initialValue?: string;
  placeholder?: string;
  confirmLabel: string;
  /** Return an error message to keep the pop-up open. */
  onSubmit(name: string): Promise<string | void>;
  onClose(): void;
};

/** Small naming pop-up (New folder, Rename folder / category), styled like the save pop-up. */
export function NamePopup({ title, label, initialValue = '', placeholder, confirmLabel, onSubmit, onClose }: Props) {
  const [value, setValue] = useState(initialValue);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const id = useId();

  const submit = async () => {
    const name = value.trim();
    if (!name) {
      setError('Give it a name');
      return;
    }
    setBusy(true);
    const problem = await onSubmit(name);
    setBusy(false);
    if (problem) setError(problem);
    else onClose();
  };

  return (
    <Modal title={title} onClose={onClose} initialFocus={inputRef} width={400}>
      <form
        className="field"
        onSubmit={(e) => {
          e.preventDefault();
          if (!busy) void submit();
        }}
        style={{ gap: 22 }}
      >
        <div className="field">
          <label htmlFor={id} className="caps">
            {label}
          </label>
          <input
            id={id}
            ref={inputRef}
            className="text-input"
            value={value}
            placeholder={placeholder}
            maxLength={40}
            aria-invalid={error ? true : undefined}
            aria-describedby={error ? `${id}-error` : undefined}
            onChange={(e) => {
              setValue(e.target.value);
              setError(null);
            }}
          />
          {error && (
            <p id={`${id}-error`} className="field-error" role="alert">
              {error}
            </p>
          )}
        </div>
        <ModalActions>
          <button type="button" className="pill pill--outline" onClick={onClose}>
            Cancel
          </button>
          <button type="submit" className="pill pill--primary" disabled={busy}>
            {confirmLabel}
          </button>
        </ModalActions>
      </form>
    </Modal>
  );
}
