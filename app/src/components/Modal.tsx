import { useEffect, useId, useRef, type ReactNode, type RefObject } from 'react';
import { createPortal } from 'react-dom';
import { Sparkle } from './icons';
import './Modal.css';

type Props = {
  title: ReactNode;
  onClose(): void;
  children: ReactNode;
  /** Element to focus on open; defaults to the first focusable element. */
  initialFocus?: RefObject<HTMLElement | null>;
  /** Extra content on the title row's right (e.g. "1 of 3"). */
  titleAside?: ReactNode;
  width?: number;
  className?: string;
};

const FOCUSABLE =
  'a[href], button:not([disabled]), input:not([disabled]), select:not([disabled]), textarea:not([disabled]), [tabindex]:not([tabindex="-1"])';

// Open dialogs, topmost last. Only the topmost one handles Esc and Tab.
const stack: HTMLElement[] = [];

export function isAnyModalOpen() {
  return stack.length > 0;
}

export function Modal({ title, onClose, children, initialFocus, titleAside, width = 440, className }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const onCloseRef = useRef(onClose);
  onCloseRef.current = onClose;

  useEffect(() => {
    const dialog = ref.current!;
    const previouslyFocused = document.activeElement as HTMLElement | null;
    stack.push(dialog);

    const target = initialFocus?.current ?? dialog.querySelector<HTMLElement>(FOCUSABLE) ?? dialog;
    target.focus();
    if (target instanceof HTMLInputElement) target.select();

    const onKey = (e: KeyboardEvent) => {
      if (stack[stack.length - 1] !== dialog) return;
      if (e.key === 'Escape') {
        // Inline fields (e.g. "+ New folder") close themselves first.
        if ((e.target as Element | null)?.closest?.('[data-own-escape]')) return;
        e.preventDefault();
        e.stopPropagation();
        onCloseRef.current();
      } else if (e.key === 'Tab') {
        const items = [...dialog.querySelectorAll<HTMLElement>(FOCUSABLE)].filter((el) => el.offsetParent !== null);
        if (items.length === 0) return;
        const first = items[0];
        const last = items[items.length - 1];
        if (e.shiftKey && (document.activeElement === first || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          last.focus();
        } else if (!e.shiftKey && (document.activeElement === last || !dialog.contains(document.activeElement))) {
          e.preventDefault();
          first.focus();
        }
      }
    };
    document.addEventListener('keydown', onKey, true);

    return () => {
      document.removeEventListener('keydown', onKey, true);
      stack.splice(stack.indexOf(dialog), 1);
      previouslyFocused?.focus?.();
    };
    // Focus is set once, on open.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return createPortal(
    <div className="modal-layer">
      <div className="modal-scrim" onClick={() => onCloseRef.current()} />
      <div
        ref={ref}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        className={`modal ${className ?? ''}`}
        style={{ width }}
      >
        <div className="modal__title-row">
          <Sparkle size={16} color="var(--sparkle-gold)" />
          <h2 id={titleId} className="modal__title">
            {title}
          </h2>
          {titleAside && <div className="modal__title-aside">{titleAside}</div>}
        </div>
        {children}
      </div>
    </div>,
    document.body,
  );
}

/** Right-aligned Cancel / primary action row used at the bottom of pop-ups. */
export function ModalActions({ children, start }: { children: ReactNode; start?: ReactNode }) {
  return (
    <div className="modal__actions">
      {start && <div className="modal__actions-start">{start}</div>}
      {children}
    </div>
  );
}
