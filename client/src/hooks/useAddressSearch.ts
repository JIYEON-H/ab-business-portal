import { useState, useEffect, useRef } from 'react';
import { NominatimSuggestion } from '../types/business';
import { useDebounce } from './useDebounce';

/**
 * Calgary bounding box passed to Nominatim as viewbox.
 * Format: left (min_lon), top (max_lat), right (max_lon), bottom (min_lat)
 */
const CALGARY_VIEWBOX = '-114.3,51.2,-113.8,50.8';
const NOMINATIM_URL = 'https://nominatim.openstreetmap.org/search';
const DEBOUNCE_MS = 300;
const MIN_QUERY_LENGTH = 3;

export type AddressSearchStatus = 'idle' | 'loading' | 'success' | 'empty' | 'error';

export interface UseAddressSearchResult {
  inputValue: string;
  setInputValue: (value: string) => void;
  suggestions: NominatimSuggestion[];
  status: AddressSearchStatus;
  clearSuggestions: (selected?: boolean) => void;
}

/**
 * Manages address autocomplete against the Nominatim OSM API.
 *
 * - Debounces keystrokes by 300ms before hitting the API.
 * - Cancels in-flight requests via AbortController when the query changes.
 * - Restricts results to the Calgary region using `viewbox` + `bounded=1`.
 * - Requires Nominatim ToS compliance: the browser's automatic Referer header
 *   (set to the portal's origin) satisfies the identification requirement.
 */
export function useAddressSearch(): UseAddressSearchResult {
  const [inputValue, setInputValue] = useState('');
  const [suggestions, setSuggestions] = useState<NominatimSuggestion[]>([]);
  const [status, setStatus] = useState<AddressSearchStatus>('idle');
  const [isSelected, setIsSelected] = useState(false);

  const debouncedQuery = useDebounce(inputValue.trim(), DEBOUNCE_MS);

  // Track the AbortController for the current in-flight request so we can
  // cancel it if the query changes before the response arrives.
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (isSelected) {
      setIsSelected(false);
      return;
    }
    // Clear suggestions and stay idle for short queries
    if (debouncedQuery.length < MIN_QUERY_LENGTH) {
      setSuggestions([]);
      setStatus('idle');
      return;
    }

    // Cancel any previous in-flight request
    abortRef.current?.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStatus('loading');

    const params = new URLSearchParams({
      q: debouncedQuery,
      format: 'jsonv2',
      addressdetails: '1',
      limit: '6',
      viewbox: CALGARY_VIEWBOX,
      bounded: '1',
    });

    fetch(`${NOMINATIM_URL}?${params.toString()}`, {
      signal: controller.signal,
      headers: {
        // Accept header per Nominatim best practices
        Accept: 'application/json',
      },
    })
      .then((res) => {
        if (!res.ok) throw new Error(`Nominatim HTTP ${res.status}`);
        return res.json() as Promise<NominatimSuggestion[]>;
      })
      .then((data) => {
        setSuggestions(data);
        setStatus(data.length === 0 ? 'empty' : 'success');
      })
      .catch((err: unknown) => {
        // AbortError is expected when the query changes — not a real error
        if (err instanceof DOMException && err.name === 'AbortError') return;
        console.error('Nominatim fetch error:', err);
        setSuggestions([]);
        setStatus('error');
      });

    return () => {
      controller.abort();
    };
  }, [debouncedQuery, isSelected]);

  function clearSuggestions(selected = false): void {
    setSuggestions([]);
    setStatus('idle');
    if (selected) {
      setIsSelected(true);
    }
  }

  return { inputValue, setInputValue, suggestions, status, clearSuggestions };
}
