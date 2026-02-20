import { useState, useCallback } from 'react';

export type GeoStatus = 'idle' | 'locating' | 'error';

export interface UseGeolocationResult {
  status: GeoStatus;
  /** Human-readable error message, set when status === 'error' */
  error: string | null;
  /**
   * Triggers a geolocation request. Calls `onSuccess` with the resolved
   * coordinates on success; sets `status` and `error` on failure.
   */
  locate: (onSuccess: (coords: { lat: number; lng: number }) => void) => void;
  /** Resets error back to idle so the user can try again */
  clearError: () => void;
}

/**
 * Thin wrapper around the browser Geolocation API.
 *
 * - Does not store coordinates in state; callers receive them via `onSuccess`.
 * - Maps all GeolocationPositionError codes to user-friendly strings.
 * - Guards against unsupported browsers gracefully.
 * - Uses `maximumAge: 60_000` so the OS can return a cached position quickly
 *   while still triggering a refresh if the cached position is stale.
 */
export function useGeolocation(): UseGeolocationResult {
  const [status, setStatus] = useState<GeoStatus>('idle');
  const [error, setError] = useState<string | null>(null);

  const clearError = useCallback(() => {
    setStatus('idle');
    setError(null);
  }, []);

  const locate = useCallback((onSuccess: (coords: { lat: number; lng: number }) => void) => {
    if (!navigator.geolocation) {
      setStatus('error');
      setError('Your browser does not support location access. Try searching by address.');
      return;
    }

    setStatus('locating');
    setError(null);

    navigator.geolocation.getCurrentPosition(
      (position) => {
        setStatus('idle');
        onSuccess({
          lat: position.coords.latitude,
          lng: position.coords.longitude,
        });
      },
      (err) => {
        setStatus('error');
        switch (err.code) {
          case err.PERMISSION_DENIED:
            setError(
              'Location access was denied. Allow location in your browser settings, or search by address.',
            );
            break;
          case err.POSITION_UNAVAILABLE:
            setError('Your location could not be determined. Try searching by address instead.');
            break;
          case err.TIMEOUT:
            setError('Location request timed out. Please try again.');
            break;
          default:
            setError('Unable to retrieve your location. Please try again or search by address.');
        }
      },
      {
        enableHighAccuracy: false, // faster fix; accuracy is sufficient for a 500 m–10 km radius search
        timeout: 10_000,
        maximumAge: 60_000,
      },
    );
  }, []);

  return { status, error, locate, clearError };
}
