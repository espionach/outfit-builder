import type { KeyboardEvent as ReactKeyboardEvent } from 'react';

let region: HTMLElement | null = null;

/** Tell screen-reader users about something that changed off to the side (e.g. a piece placed). */
export function announce(message: string) {
  if (!region) {
    region = document.createElement('div');
    region.className = 'visually-hidden';
    region.setAttribute('aria-live', 'polite');
    region.setAttribute('role', 'status');
    document.body.appendChild(region);
  }
  // Clear first so repeating the same message is announced again.
  region.textContent = '';
  const el = region;
  window.setTimeout(() => (el.textContent = message), 50);
}

/**
 * Keyboard stand-in for press-and-hold: Shift+F10 or the ContextMenu key.
 * (Browsers turn these into a contextmenu event on some platforms but not
 * reliably on macOS, so handle the keys directly.)
 */
export function isMenuKey(e: ReactKeyboardEvent) {
  return e.key === 'ContextMenu' || (e.shiftKey && e.key === 'F10');
}

export const HOLD_HINT_SELECT = 'Press and hold, or Shift+F10, to select for deleting';
export const HOLD_HINT_MANAGE = 'Press and hold, or Shift+F10, to rename or delete';
