import { useState, useEffect } from 'react';

/**
 * Returns a debounced copy of `value` that only updates after `delayMs`
 * of silence. Cleans up on unmount.
 */
export function useDebounce<T>(value: T, delayMs: number): T {
  const [debounced, setDebounced] = useState<T>(value);

  useEffect(() => {
    const timer = setTimeout(() => setDebounced(value), delayMs);
    return () => clearTimeout(timer);
  }, [value, delayMs]);

  return debounced;
}
