import { useState, useEffect, useRef, useCallback } from 'react';

const STORAGE_KEY = 'ab-sidebar-width';
const DEFAULT_WIDTH = 350;
const MIN_WIDTH = 350;
const MAX_WIDTH_FRACTION = 0.5; // sidebar may not exceed 50% of viewport

function clamp(value: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, value));
}

/**
 * Reads the persisted sidebar width from localStorage.
 * Returns DEFAULT_WIDTH for any invalid / missing value so the app
 * always starts in a consistent, usable state.
 */
function readInitialWidth(): number {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw === null) return DEFAULT_WIDTH;
    const parsed = parseInt(raw, 10);
    if (!isFinite(parsed) || parsed <= 0) return DEFAULT_WIDTH;
    // Clamp to MIN_WIDTH in case the stored value predates the constraint
    return Math.max(MIN_WIDTH, parsed);
  } catch {
    // localStorage unavailable (e.g. private browsing with storage blocked)
    return DEFAULT_WIDTH;
  }
}

export interface UseSidebarResizeResult {
  sidebarWidth: number;
  onDragHandleMouseDown: (e: React.MouseEvent) => void;
}

/**
 * Manages a resizable sidebar width with localStorage persistence.
 *
 * The drag logic uses function-scoped closures over `startX` and `startWidth`
 * so there are no stale-closure issues with the mousemove / mouseup listeners.
 * Width is persisted to localStorage only on mouseup (not on every pixel move)
 * to avoid saturating the storage API during fast drags.
 */
export function useSidebarResize(): UseSidebarResizeResult {
  const [sidebarWidth, setSidebarWidth] = useState<number>(readInitialWidth);

  // Keep a ref so the mouseup cleanup can read the latest width without
  // it being captured in the closure at mousedown time.
  const widthRef = useRef(sidebarWidth);
  useEffect(() => {
    widthRef.current = sidebarWidth;
  }, [sidebarWidth]);

  const onDragHandleMouseDown = useCallback((e: React.MouseEvent): void => {
    // Prevent text selection and default browser drag behaviour
    e.preventDefault();

    const startX = e.clientX;
    const startWidth = widthRef.current;

    function onMouseMove(ev: MouseEvent): void {
      const maxWidth = Math.floor(window.innerWidth * MAX_WIDTH_FRACTION);
      setSidebarWidth(clamp(startWidth + (ev.clientX - startX), MIN_WIDTH, maxWidth));
    }

    function onMouseUp(): void {
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
      try {
        localStorage.setItem(STORAGE_KEY, String(widthRef.current));
      } catch {
        // localStorage write failed — ignore, width persists only for this session
      }
    }

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
    // Override cursor globally during drag so it doesn't flicker when the
    // mouse briefly leaves the narrow handle element
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  }, []); // no deps — reads widthRef.current at call-time, never stale

  return { sidebarWidth, onDragHandleMouseDown };
}
