import { useEffect, useMemo } from 'react';
import { PublicBusinessRecord, CategorySummary, CategoryGapEntry } from '../../types/business';

// ─── Gap computation ──────────────────────────────────────────────────────────

const MIN_CITY_PCT = 0.3;
const TOP_N = 7;

function computeGapEntries(
  localBusinesses: PublicBusinessRecord[],
  cityCategories: CategorySummary[],
): CategoryGapEntry[] | null {
  if (cityCategories.length === 0 || localBusinesses.length === 0) return null;

  const cityTotal = cityCategories.reduce((sum, c) => sum + c.count, 0);
  const localTotal = localBusinesses.length;

  const localCounts = new Map<string, number>();
  for (const b of localBusinesses) {
    localCounts.set(b.category, (localCounts.get(b.category) ?? 0) + 1);
  }

  return cityCategories
    .filter((c) => (c.count / cityTotal) * 100 >= MIN_CITY_PCT)
    .map((c) => {
      const cityPct = (c.count / cityTotal) * 100;
      const localCount = localCounts.get(c.category) ?? 0;
      const localPct = (localCount / localTotal) * 100;
      const gapPct = localPct - cityPct;
      const relativeGapPct = cityPct > 0 ? (gapPct / cityPct) * 100 : 0;
      return { category: c.category, localCount, localPct, cityPct, gapPct, relativeGapPct };
    })
    .sort((a, b) => a.gapPct - b.gapPct);
}

// ─── Shared button reset styles ────────────────────────────────────────────────

/** CSS reset for <button> so it inherits surrounding typography */
const BTN_RESET: React.CSSProperties = {
  display: 'block',
  width: '100%',
  background: 'none',
  border: 'none',
  padding: 0,
  margin: 0,
  cursor: 'pointer',
  textAlign: 'left',
  fontFamily: 'inherit',
  fontSize: 'inherit',
  color: 'inherit',
  lineHeight: 'inherit',
  borderRadius: 6,
  boxSizing: 'border-box',
};

/** Returns the active-state overlay styles for a selected row */
function activeRowStyle(isActive: boolean): React.CSSProperties {
  return {
    padding: '0.375rem 0.5rem',
    margin: '0 -0.5rem',
    width: 'calc(100% + 1rem)',
    borderRadius: 6,
    backgroundColor: isActive ? '#eff6ff' : 'transparent',
    outline: isActive ? '1.5px solid #93c5fd' : '1.5px solid transparent',
    transition: 'background-color 0.12s, outline-color 0.12s',
  };
}

// ─── GapBar ───────────────────────────────────────────────────────────────────

interface GapBarProps {
  entry: CategoryGapEntry;
  maxScale: number;
  variant: 'under' | 'over';
}

function GapBar({ entry, maxScale, variant }: GapBarProps): JSX.Element {
  const safe = maxScale > 0 ? maxScale : 1;
  const cityWidth  = Math.min((entry.cityPct  / safe) * 100, 100);
  const localWidth = Math.min((entry.localPct / safe) * 100, 100);
  const barColor   = variant === 'under' ? '#f97316' : '#16a34a';

  return (
    <div
      role="presentation"
      style={{ position: 'relative', height: 8, borderRadius: 4, backgroundColor: '#f3f4f6', overflow: 'hidden' }}
    >
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${cityWidth}%`,  backgroundColor: '#d1d5db', borderRadius: 4 }} />
      <div style={{ position: 'absolute', left: 0, top: 0, height: '100%', width: `${localWidth}%`, backgroundColor: barColor, borderRadius: 4, transition: 'width 0.35s ease' }} />
    </div>
  );
}

// ─── GapSection ───────────────────────────────────────────────────────────────

interface GapSectionProps {
  title: string;
  entries: CategoryGapEntry[];
  variant: 'under' | 'over';
  headingId: string;
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

function GapSection({ title, entries, variant, headingId, selectedCategory, onSelectCategory }: GapSectionProps): JSX.Element {
  const maxScale    = Math.max(...entries.map((e) => e.cityPct), 1);
  const accentColor = variant === 'under' ? '#c2410c' : '#15803d';
  const badgeBg     = variant === 'under' ? '#fff7ed' : '#f0fdf4';
  const badgeBorder = variant === 'under' ? '#fed7aa' : '#bbf7d0';

  return (
    <section aria-labelledby={headingId} style={{ marginBottom: '1.25rem' }}>
      <h3
        id={headingId}
        style={{ margin: '0 0 0.625rem', fontSize: '0.8125rem', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '0.04em', color: accentColor }}
      >
        {title}
      </h3>

      <ol
        aria-label={`${title} categories`}
        style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.75rem' }}
      >
        {entries.map((e) => {
          const isActive = selectedCategory === e.category;
          const relLabel =
            Math.abs(e.relativeGapPct) < 1
              ? 'on par'
              : `${e.relativeGapPct > 0 ? '+' : ''}${Math.round(e.relativeGapPct)}% vs. city avg`;

          return (
            <li key={e.category}>
              <button
                type="button"
                aria-pressed={isActive}
                aria-label={`${isActive ? 'Deselect' : 'Select'} ${e.category} — ${relLabel}`}
                onClick={() => onSelectCategory(isActive ? null : e.category)}
                onMouseEnter={(ev) => { if (!isActive) ev.currentTarget.style.backgroundColor = '#f8fafc'; }}
                onMouseLeave={(ev) => { if (!isActive) ev.currentTarget.style.backgroundColor = 'transparent'; }}
                style={{ ...BTN_RESET, ...activeRowStyle(isActive) }}
              >
                {/* Row 1: name + badge */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '0.25rem', gap: '0.5rem' }}>
                  <span style={{ fontSize: '0.8125rem', fontWeight: isActive ? 700 : 500, color: isActive ? '#1e40af' : '#111827', minWidth: 0 }}>
                    {e.category}
                  </span>
                  <span
                    aria-hidden="true"
                    style={{ flexShrink: 0, fontSize: '0.6875rem', fontWeight: 600, backgroundColor: badgeBg, border: `1px solid ${badgeBorder}`, color: accentColor, borderRadius: 9999, padding: '0.0625rem 0.5rem', whiteSpace: 'nowrap' }}
                  >
                    {relLabel}
                  </span>
                </div>

                {/* Bar */}
                <GapBar entry={e} maxScale={maxScale} variant={variant} />

                {/* Row 3: counts */}
                <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: '0.1875rem', fontSize: '0.6875rem', color: '#6b7280' }}>
                  <span>Local <strong style={{ color: '#374151' }}>{e.localCount} ({e.localPct.toFixed(1)}%)</strong></span>
                  <span>City avg <strong style={{ color: '#374151' }}>{e.cityPct.toFixed(1)}%</strong></span>
                </div>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// ─── CityWideBars ─────────────────────────────────────────────────────────────

interface CityWideBarsProps {
  categories: CategorySummary[];
  selectedCategory: string | null;
  onSelectCategory: (cat: string | null) => void;
}

function CityWideBars({ categories, selectedCategory, onSelectCategory }: CityWideBarsProps): JSX.Element {
  const top      = categories.slice(0, 20);
  const maxCount = top[0]?.count ?? 1;

  return (
    <ol
      aria-label="Business categories by city-wide license count"
      style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexDirection: 'column', gap: '0.5rem' }}
    >
      {top.map((cat, idx) => {
        const isActive = selectedCategory === cat.category;

        return (
          <li key={cat.category}>
            <button
              type="button"
              aria-pressed={isActive}
              aria-label={`${isActive ? 'Deselect' : 'Select'} ${cat.category}`}
              onClick={() => onSelectCategory(isActive ? null : cat.category)}
              onMouseEnter={(ev) => { if (!isActive) ev.currentTarget.style.backgroundColor = '#f8fafc'; }}
              onMouseLeave={(ev) => { if (!isActive) ev.currentTarget.style.backgroundColor = 'transparent'; }}
              style={{ ...BTN_RESET, ...activeRowStyle(isActive) }}
            >
              {/* Name + count */}
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.8125rem', marginBottom: '0.1875rem' }}>
                <span>
                  <span aria-hidden="true" style={{ color: '#9ca3af', marginRight: '0.25rem' }}>{idx + 1}.</span>
                  <span style={{ fontWeight: isActive ? 700 : 400, color: isActive ? '#1e40af' : 'inherit' }}>{cat.category}</span>
                </span>
                <span aria-label={`${cat.count.toLocaleString()} licenses`} style={{ color: '#6b7280', flexShrink: 0 }}>
                  {cat.count.toLocaleString()}
                </span>
              </div>

              {/* Progress bar */}
              <div
                role="progressbar"
                aria-valuenow={cat.count}
                aria-valuemin={0}
                aria-valuemax={maxCount}
                aria-label={`${cat.category}: ${cat.count} businesses`}
                style={{ height: 6, backgroundColor: '#e5e7eb', borderRadius: 3, overflow: 'hidden' }}
              >
                <div
                  style={{
                    width: `${Math.round((cat.count / maxCount) * 100)}%`,
                    height: '100%',
                    backgroundColor: isActive ? '#f59e0b' : '#005a9c',
                    borderRadius: 3,
                    transition: 'width 0.3s ease, background-color 0.15s',
                  }}
                />
              </div>
            </button>
          </li>
        );
      })}
    </ol>
  );
}

// ─── Main panel ───────────────────────────────────────────────────────────────

export interface CategoryGapPanelProps {
  localBusinesses: PublicBusinessRecord[];
  cityCategories: CategorySummary[];
  categoriesLoading: boolean;
  onLoadCityCategories: () => void;
  selectedCoords: { lat: number; lng: number } | null;
  radius: number;
  /** Category currently highlighted on the map, or null if none */
  selectedCategory: string | null;
  /** Lift category selection up to MapView so the marker layer can react */
  onSelectCategory: (category: string | null) => void;
}

export function CategoryGapPanel({
  localBusinesses,
  cityCategories,
  categoriesLoading,
  onLoadCityCategories,
  selectedCoords,
  radius,
  selectedCategory,
  onSelectCategory,
}: CategoryGapPanelProps): JSX.Element {
  useEffect(() => {
    onLoadCityCategories();
  }, [onLoadCityCategories]);

  const gapEntries = useMemo(
    () => computeGapEntries(localBusinesses, cityCategories),
    [localBusinesses, cityCategories],
  );

  const underRepresented = gapEntries?.slice(0, TOP_N) ?? [];
  const overRepresented  = (gapEntries?.slice(-TOP_N) ?? []).reverse();

  const isComparisonMode = selectedCoords !== null && localBusinesses.length > 0;
  const radiusLabel      = radius >= 1000 ? `${radius / 1000} km` : `${radius} m`;

  return (
    <section aria-labelledby="gap-panel-heading" aria-live="polite" style={{ padding: '1rem' }}>
      {/* Header */}
      <h2 id="gap-panel-heading" style={{ margin: '0 0 0.25rem', fontSize: '1rem', fontWeight: 600, color: '#111827' }}>
        {isComparisonMode ? 'Gap Analysis' : 'City-Wide Breakdown'}
      </h2>

      {isComparisonMode && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#6b7280', lineHeight: 1.4 }}>
          Comparing{' '}
          <strong style={{ color: '#374151' }}>{localBusinesses.length} businesses</strong>{' '}
          within {radiusLabel} against the Calgary average.{' '}
          <span style={{ color: '#9ca3af' }}>Click a category to highlight it on the map.</span>
        </p>
      )}

      {!isComparisonMode && cityCategories.length > 0 && !categoriesLoading && (
        <p style={{ margin: '0 0 0.75rem', fontSize: '0.75rem', color: '#9ca3af', lineHeight: 1.4 }}>
          Click a category to highlight matching businesses on the map.
        </p>
      )}

      {/* Loading */}
      {categoriesLoading && (
        <p aria-busy="true" style={{ color: '#6b7280', fontSize: '0.875rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          <span aria-hidden="true" style={{ display: 'inline-block', width: 14, height: 14, border: '2px solid #d1d5db', borderTopColor: '#005a9c', borderRadius: '50%', animation: 'spin 0.7s linear infinite' }} />
          Loading city-wide data…
          <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
        </p>
      )}

      {/* No city data */}
      {!categoriesLoading && cityCategories.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>No category data available.</p>
      )}

      {/* Comparison mode */}
      {!categoriesLoading && isComparisonMode && gapEntries !== null && (
        <>
          {underRepresented.length > 0 && (
            <GapSection
              title="Under-represented"
              entries={underRepresented}
              variant="under"
              headingId="gap-under-heading"
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
            />
          )}

          {overRepresented.length > 0 && (
            <GapSection
              title="Strongest presence"
              entries={overRepresented}
              variant="over"
              headingId="gap-over-heading"
              selectedCategory={selectedCategory}
              onSelectCategory={onSelectCategory}
            />
          )}

          {/* Legend */}
          <div
            aria-hidden="true"
            style={{ marginTop: '0.75rem', padding: '0.5rem 0.75rem', backgroundColor: '#f9fafb', border: '1px solid #e5e7eb', borderRadius: 4, fontSize: '0.6875rem', color: '#6b7280', display: 'flex', flexDirection: 'column', gap: '0.25rem' }}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.375rem' }}>
              <div style={{ width: 24, height: 8, backgroundColor: '#f97316', borderRadius: 2 }} />
              <span>Local share</span>
              <div style={{ width: 24, height: 8, backgroundColor: '#d1d5db', borderRadius: 2, marginLeft: '0.5rem' }} />
              <span>City average</span>
            </div>
            <span>Bars share the same scale within each section.</span>
          </div>
        </>
      )}

      {/* Location selected, no businesses */}
      {!categoriesLoading && selectedCoords !== null && localBusinesses.length === 0 && (
        <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
          No businesses found in this area. Try increasing the search radius.
        </p>
      )}

      {/* City-wide mode */}
      {!categoriesLoading && !isComparisonMode && cityCategories.length > 0 && (
        <CityWideBars
          categories={cityCategories}
          selectedCategory={selectedCategory}
          onSelectCategory={onSelectCategory}
        />
      )}
    </section>
  );
}
