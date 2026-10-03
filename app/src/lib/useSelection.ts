import { useCallback, useEffect, useState } from 'react';
import { isAnyModalOpen } from '../components/Modal';

/**
 * Selection mode shared by the wardrobe and saved outfits (BUILD_SPEC.md §4.5, §4.7).
 * `selected` is null outside selection mode. Deselecting the last item exits.
 */
export function useSelection<T extends string>() {
  const [selected, setSelected] = useState<Set<T> | null>(null);

  const start = useCallback((id: T) => setSelected(new Set([id])), []);
  const exit = useCallback(() => setSelected(null), []);
  const toggle = useCallback(
    (id: T) =>
      setSelected((cur) => {
        if (!cur) return cur;
        const next = new Set(cur);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next.size ? next : null;
      }),
    [],
  );
  /** Drop ids that no longer exist (e.g. deleted elsewhere). */
  const prune = useCallback(
    (exists: (id: T) => boolean) =>
      setSelected((cur) => {
        if (!cur) return cur;
        const next = new Set([...cur].filter(exists));
        if (next.size === cur.size) return cur;
        return next.size ? next : null;
      }),
    [],
  );

  const active = selected !== null;
  useEffect(() => {
    if (!active) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && !isAnyModalOpen()) setSelected(null);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [active]);

  return { selected, active, start, toggle, exit, prune };
}
