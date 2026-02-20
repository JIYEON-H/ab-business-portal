import { useRef, useEffect, KeyboardEvent } from 'react';
import { NearbyQuery, NominatimSuggestion } from '../../types/business';
import { useAddressSearch } from '../../hooks/useAddressSearch';
import { useGeolocation } from '../../hooks/useGeolocation';

interface ProximitySearchProps {
  onSearch: (query: NearbyQuery) => void;
  /** Current radius in metres — owner controls this so the map can sync */
  radius: number;
  onRadiusChange: (radius: number) => void;
  /** Cleared by parent when new bounding-box data replaces proximity results */
  selectedCoords: { lat: number; lng: number } | null;
  onCoordsChange: (coords: { lat: number; lng: number } | null) => void;
  loading: boolean;
}

const RADIUS_OPTIONS = [500, 1000, 2000, 5000, 10000];

/** Maps a search radius to an appropriate map zoom level */
function radiusToZoom(radiusMetres: number): number {
  if (radiusMetres <= 500) return 16;
  if (radiusMetres <= 1000) return 15;
  if (radiusMetres <= 2000) return 14;
  if (radiusMetres <= 5000) return 13;
  return 12;
}

/** Format a Nominatim display_name for compact display in the dropdown */
function formatSuggestion(s: NominatimSuggestion): { primary: string; secondary: string } {
  if (!s.address) return { primary: s.display_name, secondary: '' };

  const primary =
    [s.address.house_number, s.address.road].filter(Boolean).join(' ') ||
    s.address.suburb ||
    s.address.neighbourhood ||
    s.display_name.split(',')[0];

  const secondary = [s.address.suburb, s.address.city ?? s.address.town, s.address.postcode]
    .filter(Boolean)
    .join(', ');

  return { primary: primary ?? s.display_name, secondary };
}

// ─── Styles ────────────────────────────────────────────────────────────────────
const INPUT_STYLE: React.CSSProperties = {
  width: '100%',
  padding: '0.5rem 2rem 0.5rem 0.625rem', // right padding for clear button
  border: '1px solid #767676',
  borderRadius: 4,
  fontSize: '0.875rem',
  lineHeight: 1.4,
  boxSizing: 'border-box',
  outline: 'none',
};

const DROPDOWN_STYLE: React.CSSProperties = {
  position: 'absolute',
  top: '100%',
  left: 0,
  right: 0,
  zIndex: 9999,
  backgroundColor: '#fff',
  border: '1px solid #d1d5db',
  borderTop: 'none',
  borderRadius: '0 0 4px 4px',
  boxShadow: '0 4px 12px rgba(0,0,0,0.12)',
  maxHeight: 280,
  overflowY: 'auto',
  listStyle: 'none',
  margin: 0,
  padding: 0,
};

export function ProximitySearch({
  onSearch,
  radius,
  onRadiusChange,
  selectedCoords,
  onCoordsChange,
  loading,
}: ProximitySearchProps): JSX.Element {
  const { inputValue, setInputValue, suggestions, status, clearSuggestions } = useAddressSearch();
  const { status: geoStatus, error: geoError, locate, clearError: clearGeoError } = useGeolocation();

  // activeIndex tracks keyboard-focused suggestion (-1 = none)
  const activeIndexRef = useRef(-1);
  const activeIndexForceUpdateRef = useRef(0); // increment to trigger re-render
  const inputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  // Keep a stable ref to avoid stale closure in keyboard handler
  const onSearchRef = useRef(onSearch);
  useEffect(() => { onSearchRef.current = onSearch; }, [onSearch]);

  const isOpen = suggestions.length > 0 && status === 'success';

  // When radius changes and an address is already selected, re-fire the search
  useEffect(() => {
    if (selectedCoords) {
      onSearchRef.current({ ...selectedCoords, radius });
    }
    // We intentionally only react to radius changes here, not selectedCoords changes
    // (those are handled in handleSelect). ESLint disable is intentional.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [radius]);

  function handleSelect(suggestion: NominatimSuggestion): void {
    const lat = parseFloat(suggestion.lat);
    const lng = parseFloat(suggestion.lon);

    setInputValue(suggestion.display_name);
    clearSuggestions(true);
    activeIndexRef.current = -1;

    const coords = { lat, lng };
    onCoordsChange(coords);
    onSearch({ lat, lng, radius });

    // Return focus to the input but don't reopen suggestions
    inputRef.current?.focus();
  }

  function handleInputChange(value: string): void {
    setInputValue(value);
    // Typing again after a selection clears the pinned coordinates
    if (selectedCoords) {
      onCoordsChange(null);
    }
    activeIndexRef.current = -1;
  }

  function handleClear(): void {
    setInputValue('');
    clearSuggestions();
    onCoordsChange(null);
    activeIndexRef.current = -1;
    inputRef.current?.focus();
  }

  function handleLocate(): void {
    clearGeoError();
    locate((coords) => {
      // Mirror the handleSelect flow: set a display label, suppress the
      // Nominatim debounce, then fire the nearby search.
      setInputValue('My Current Location');
      clearSuggestions(true);
      activeIndexRef.current = -1;
      onCoordsChange(coords);
      onSearchRef.current({ ...coords, radius });
    });
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>): void {
    if (!isOpen) return;

    const count = suggestions.length;

    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault();
        activeIndexRef.current = Math.min(activeIndexRef.current + 1, count - 1);
        activeIndexForceUpdateRef.current++;
        scrollOptionIntoView(activeIndexRef.current);
        break;

      case 'ArrowUp':
        e.preventDefault();
        activeIndexRef.current = Math.max(activeIndexRef.current - 1, -1);
        activeIndexForceUpdateRef.current++;
        scrollOptionIntoView(activeIndexRef.current);
        break;

      case 'Enter':
        e.preventDefault();
        if (activeIndexRef.current >= 0 && activeIndexRef.current < count) {
          handleSelect(suggestions[activeIndexRef.current]);
        }
        break;

      case 'Escape':
        e.preventDefault();
        clearSuggestions();
        activeIndexRef.current = -1;
        break;

      case 'Tab':
        // Close on Tab so focus moves naturally
        clearSuggestions();
        activeIndexRef.current = -1;
        break;
    }
  }

  function scrollOptionIntoView(index: number): void {
    if (!listRef.current) return;
    const item = listRef.current.children[index] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }

  const activeOptionId =
    activeIndexRef.current >= 0 ? `address-option-${activeIndexRef.current}` : undefined;

  // Derive a compact label for the "selected" hint shown below the input
  const selectedLabel = selectedCoords
    ? inputValue.split(',').slice(0, 2).join(', ')
    : null;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '0.875rem' }}>
      <h2 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Search Nearby</h2>

      {/* ── Address combobox ── */}
      <div>
        {/* Label row — label on left, "Use my location" button on right */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: '0.3125rem' }}>
          <label
            htmlFor="address-input"
            style={{ fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}
          >
            Address or neighbourhood
          </label>

          <button
            type="button"
            onClick={handleLocate}
            disabled={geoStatus === 'locating' || loading}
            aria-label={geoStatus === 'locating' ? 'Detecting your location…' : 'Use my current location'}
            style={{
              background: 'none',
              border: 'none',
              padding: 0,
              cursor: geoStatus === 'locating' || loading ? 'not-allowed' : 'pointer',
              color: geoStatus === 'locating' ? '#6b7280' : '#005a9c',
              fontSize: '0.75rem',
              fontWeight: 500,
              display: 'flex',
              alignItems: 'center',
              gap: '0.25rem',
              opacity: geoStatus === 'locating' || loading ? 0.6 : 1,
              fontFamily: 'inherit',
            }}
          >
            {geoStatus === 'locating' ? (
              <>
                <span
                  aria-hidden="true"
                  style={{
                    display: 'inline-block',
                    width: 10,
                    height: 10,
                    border: '1.5px solid #d1d5db',
                    borderTopColor: '#005a9c',
                    borderRadius: '50%',
                    animation: 'spin 0.7s linear infinite',
                  }}
                />
                Detecting…
              </>
            ) : (
              <>
                <span aria-hidden="true">&#9678;</span>
                Use my location
              </>
            )}
          </button>
        </div>

        {/* Combobox wrapper — position:relative anchors the dropdown */}
        <div style={{ position: 'relative' }}>
          <div
            role="combobox"
            aria-expanded={isOpen}
            aria-haspopup="listbox"
            aria-owns="address-listbox"
          >
            <input
              ref={inputRef}
              id="address-input"
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              value={inputValue}
              onChange={(e) => handleInputChange(e.target.value)}
              onKeyDown={handleKeyDown}
              aria-autocomplete="list"
              aria-controls="address-listbox"
              aria-activedescendant={activeOptionId}
              aria-label="Search for an address or neighbourhood in Calgary"
              aria-busy={status === 'loading'}
              placeholder="e.g. 17 Ave SW, Kensington…"
              style={{
                ...INPUT_STYLE,
                borderColor: isOpen ? '#005a9c' : '#767676',
                // Subtle focus ring that meets WCAG 3:1 non-text contrast
                boxShadow: isOpen ? '0 0 0 2px rgba(0,90,156,0.25)' : undefined,
              }}
            />

            {/* Clear button — visible whenever there is input text */}
            {inputValue.length > 0 && (
              <button
                type="button"
                onClick={handleClear}
                aria-label="Clear address search"
                tabIndex={-1}
                style={{
                  position: 'absolute',
                  right: '0.4rem',
                  top: '45%',
                  transform: 'translateY(-50%)',
                  background: 'none',
                  border: 'none',
                  cursor: 'pointer',
                  color: '#6b7280',
                  fontSize: '1.125rem',
                  lineHeight: 1,
                  padding: '0.125rem',
                  display: 'flex',
                  alignItems: 'center',
                }}
              >
                x
              </button>
            )}
          </div>

          {/* ── Status feedback below the input ── */}
          {status === 'loading' && (
            <p
              aria-live="polite"
              style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}
            >
              Searching…
            </p>
          )}
          {status === 'error' && (
            <p
              role="alert"
              style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#b91c1c' }}
            >
              Address lookup failed. Check your connection and try again.
            </p>
          )}
          {/* Geolocation error — shown when browser API fails or permission is denied */}
          {geoStatus === 'error' && geoError !== null && (
            <p
              role="alert"
              style={{
                margin: '0.25rem 0 0',
                fontSize: '0.75rem',
                color: '#b91c1c',
                display: 'flex',
                alignItems: 'flex-start',
                gap: '0.25rem',
              }}
            >
              <span aria-hidden="true" style={{ flexShrink: 0 }}>&#9888;</span>
              {geoError}
            </p>
          )}

          {/* ── Suggestions dropdown ── */}
          {isOpen && (
            <ul
              ref={listRef}
              id="address-listbox"
              role="listbox"
              aria-label="Address suggestions"
              style={DROPDOWN_STYLE}
            >
              {suggestions.map((s, idx) => {
                const isActive = idx === activeIndexRef.current;
                const { primary, secondary } = formatSuggestion(s);
                return (
                  <li
                    key={s.place_id}
                    id={`address-option-${idx}`}
                    role="option"
                    aria-selected={isActive}
                    onMouseDown={(e) => {
                      // Prevent blur on the input before we can handle the click
                      e.preventDefault();
                    }}
                    onClick={() => handleSelect(s)}
                    onMouseEnter={() => {
                      activeIndexRef.current = idx;
                    }}
                    style={{
                      padding: '0.5rem 0.75rem',
                      cursor: 'pointer',
                      backgroundColor: isActive ? '#eff6ff' : 'transparent',
                      borderBottom: idx < suggestions.length - 1 ? '1px solid #f3f4f6' : 'none',
                    }}
                  >
                    <div
                      style={{
                        fontSize: '0.8125rem',
                        fontWeight: 500,
                        color: '#111827',
                        whiteSpace: 'nowrap',
                        overflow: 'hidden',
                        textOverflow: 'ellipsis',
                      }}
                    >
                      {primary}
                    </div>
                    {secondary && (
                      <div
                        style={{
                          fontSize: '0.75rem',
                          color: '#6b7280',
                          marginTop: '0.0625rem',
                          whiteSpace: 'nowrap',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                        }}
                      >
                        {secondary}
                      </div>
                    )}
                  </li>
                );
              })}
            </ul>
          )}

          {/* Empty state — show only after a real search attempt */}
          {status === 'empty' && (
            <p
              aria-live="polite"
              style={{ margin: '0.25rem 0 0', fontSize: '0.75rem', color: '#6b7280' }}
            >
              No Calgary addresses found. Try a street name or neighbourhood.
            </p>
          )}
        </div>

        {/* Selected address confirmation chip */}
        {selectedLabel && (
          <div
            aria-live="polite"
            style={{
              marginTop: '0.375rem',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '0.25rem',
              backgroundColor: '#eff6ff',
              border: '1px solid #bfdbfe',
              borderRadius: 9999,
              padding: '0.125rem 0.625rem',
              fontSize: '0.75rem',
              color: '#1e40af',
            }}
          >
            {/* Pin icon */}
            <span aria-hidden="true">📍</span>
            <span>{selectedLabel}</span>
          </div>
        )}
      </div>

      {/* ── Radius selector ── */}
      <fieldset
        style={{ border: '1px solid #d1d5db', borderRadius: 4, padding: '0.5rem 0.75rem', margin: 0 }}
      >
        <legend
          style={{ fontSize: '0.8125rem', fontWeight: 500, padding: '0 0.25rem', color: '#374151' }}
        >
          Search radius
        </legend>
        <div
          role="group"
          aria-label="Radius options"
          style={{ display: 'flex', flexWrap: 'wrap', gap: '0.375rem', paddingTop: '0.25rem' }}
        >
          {RADIUS_OPTIONS.map((r) => (
            <label
              key={r}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '0.25rem',
                cursor: 'pointer',
                padding: '0.25rem 0.5rem',
                borderRadius: 4,
                backgroundColor: radius === r ? '#eff6ff' : 'transparent',
                border: `1px solid ${radius === r ? '#93c5fd' : 'transparent'}`,
                fontSize: '0.8125rem',
                color: radius === r ? '#1e40af' : '#374151',
                fontWeight: radius === r ? 600 : 400,
                transition: 'background-color 0.1s, border-color 0.1s',
              }}
            >
              <input
                type="radio"
                name="radius"
                value={r}
                checked={radius === r}
                onChange={() => onRadiusChange(r)}
                style={{ accentColor: '#005a9c' }}
                aria-label={`${r >= 1000 ? `${r / 1000} km` : `${r} m`} radius`}
              />
              {r >= 1000 ? `${r / 1000} km` : `${r} m`}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Hint text */}
      <p style={{ margin: 0, fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.4 }}>
        {selectedCoords
          ? 'Change the radius to instantly refresh results.'
          : 'Select an address above to search for nearby businesses.'}
      </p>

      {/* Loading state indicator for data fetch */}
      {loading && (
        <div
          aria-live="polite"
          aria-busy="true"
          style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '0.8125rem', color: '#6b7280' }}
        >
          <span
            aria-hidden="true"
            style={{
              display: 'inline-block',
              width: 14,
              height: 14,
              border: '2px solid #d1d5db',
              borderTopColor: '#005a9c',
              borderRadius: '50%',
              animation: 'spin 0.7s linear infinite',
            }}
          />
          Loading businesses…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </div>
      )}
    </div>
  );
}

export { radiusToZoom };
