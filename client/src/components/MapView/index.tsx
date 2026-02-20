import { useCallback, useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, useMapEvents, useMap, Marker, Popup } from 'react-leaflet';
import L from 'leaflet';
import { LatLngBounds } from 'leaflet';
import { BusinessHeatmap } from './BusinessHeatmap';
import { ProximitySearch, radiusToZoom } from './ProximitySearch';
import { CategoryGapPanel } from './CategoryGapPanel';
import { useBusinessData } from '../../hooks/useBusinessData';
import { useSidebarResize } from '../../hooks/useSidebarResize';
import { PublicBusinessRecord, BoundingBox, NearbyQuery } from '../../types/business';
import 'leaflet/dist/leaflet.css';

const CALGARY_CENTER: [number, number] = [51.0447, -114.0719];
const DEFAULT_ZOOM = 12;

// ─── Marker icons ─────────────────────────────────────────────────────────────
//
// Three DivIcon variants created once at module load (L.divIcon is a pure
// object factory — no DOM interaction, safe to call before first render).
// Keeping them module-level means the same object reference is reused across
// all marker renders, so react-leaflet never calls marker.setIcon() unless the
// variant actually changes.

function createMarkerIcon(variant: 'default' | 'highlight' | 'dimmed'): L.DivIcon {
  const cfg = {
    default:   { bg: '#005a9c', border: '#003d6b', size: 10, opacity: '1',   pulse: '' },
    highlight: { bg: '#f59e0b', border: '#92400e', size: 14, opacity: '1',   pulse: 'animation:mpulse 1.5s ease-in-out infinite;' },
    dimmed:    { bg: '#94a3b8', border: '#64748b', size: 8,  opacity: '0.35', pulse: '' },
  }[variant];

  const { bg, border, size, opacity, pulse } = cfg;

  return L.divIcon({
    // className:'' removes Leaflet's default white-box styling
    className: '',
    html: `<div style="width:${size}px;height:${size}px;border-radius:50%;background:${bg};border:2px solid ${border};opacity:${opacity};${pulse}box-sizing:border-box;"></div>`,
    iconSize:    [size, size],
    iconAnchor:  [size / 2, size / 2],
    popupAnchor: [0, -(size / 2 + 2)],
  });
}

const MARKER_ICONS = {
  default:   createMarkerIcon('default'),
  highlight: createMarkerIcon('highlight'),
  dimmed:    createMarkerIcon('dimmed'),
} as const;

// ─── Sub-components inside MapContainer ───────────────────────────────────────

interface FlyToTarget {
  lat: number;
  lng: number;
  zoom: number;
  seq: number;
}

function FlyToController({ target }: { target: FlyToTarget | null }): null {
  const map = useMap();
  const prevSeq = useRef(-1);

  useEffect(() => {
    if (!target || target.seq === prevSeq.current) return;
    prevSeq.current = target.seq;
    map.flyTo([target.lat, target.lng], target.zoom, { duration: 1.2, easeLinearity: 0.4 });
  }, [map, target]);

  return null;
}

/**
 * Calls map.invalidateSize() whenever the sidebar width changes so Leaflet
 * redraws tiles to fill the new map container dimensions.
 * Must be rendered inside <MapContainer> to access the Leaflet map instance.
 */
function MapResizer({ sidebarWidth }: { sidebarWidth: number }): null {
  const map = useMap();

  useEffect(() => {
    // Defer to the next task so the browser has committed the new CSS layout
    // before Leaflet measures the container.
    const id = setTimeout(() => { map.invalidateSize(); }, 0);
    return () => { clearTimeout(id); };
  }, [map, sidebarWidth]);

  return null;
}

function MapBoundsHandler({ onBoundsChange }: { onBoundsChange: (bbox: BoundingBox) => void }): null {
  useMapEvents({
    moveend(e) {
      const bounds: LatLngBounds = e.target.getBounds() as LatLngBounds;
      onBoundsChange({
        north: bounds.getNorth(),
        south: bounds.getSouth(),
        east:  bounds.getEast(),
        west:  bounds.getWest(),
      });
    },
  });
  return null;
}

interface MarkerLayerProps {
  businesses: PublicBusinessRecord[];
  selectedCategory: string | null;
}

/**
 * Renders up to 50 markers with three visual states:
 *   highlight — matching the selected category (amber, larger, animated)
 *   dimmed    — non-matching (gray, smaller, semi-transparent)
 *   default   — no filter active (GoA blue, standard size)
 *
 * Icon objects are module-level constants, so react-leaflet only calls
 * marker.setIcon() when the variant string changes — not on every render.
 */
function HighlightableMarkerLayer({ businesses, selectedCategory }: MarkerLayerProps): JSX.Element {
  // Inject the pulse keyframe once into the document head
  useEffect(() => {
    const id = 'ab-marker-pulse-css';
    if (document.getElementById(id)) return;
    const style = document.createElement('style');
    style.id = id;
    style.textContent = '@keyframes mpulse{0%,100%{transform:scale(1)}50%{transform:scale(1.22)}}';
    document.head.appendChild(style);
    // intentionally not removed on unmount — harmless and avoids flash if component remounts
  }, []);

  return (
    <>
      {businesses.map((b) => {
        if (b.lat === null || b.lng === null) return null;

        const variant =
          selectedCategory === null
            ? 'default'
            : b.category === selectedCategory
              ? 'highlight'
              : 'dimmed';

        return (
          <Marker key={b.id} position={[b.lat, b.lng]} icon={MARKER_ICONS[variant]}>
            <Popup>
              <strong>{b.name}</strong>
              <br />
              {b.category}
              <br />
              <span style={{ color: b.status === 'Active' ? '#166534' : '#92400e' }}>
                {b.status}
              </span>
            </Popup>
          </Marker>
        );
      })}
    </>
  );
}

// ─── Main component ────────────────────────────────────────────────────────────

export function MapView(): JSX.Element {
  const {
    businesses,
    cityCategories,
    businessesLoading,
    categoriesLoading,
    error,
    fetchByBoundingBox,
    fetchNearby,
    fetchCityCategories,
    clearError,
  } = useBusinessData();

  const [activeTab,       setActiveTab]       = useState<'search' | 'categories'>('search');
  const [radius,          setRadius]          = useState(1000);
  const [selectedCoords,  setSelectedCoords]  = useState<{ lat: number; lng: number } | null>(null);
  const [flyToTarget,     setFlyToTarget]     = useState<FlyToTarget | null>(null);
  const [selectedCategory, setSelectedCategory] = useState<string | null>(null);
  const flySeqRef = useRef(0);

  const { sidebarWidth, onDragHandleMouseDown } = useSidebarResize();

  const handleSelectCategory = useCallback((cat: string | null) => {
    setSelectedCategory(cat);
  }, []);

  const handleBoundsChange = useCallback(
    (bbox: BoundingBox) => {
      void fetchByBoundingBox(bbox);
      setSelectedCategory(null); // clear filter on map pan/zoom
    },
    [fetchByBoundingBox],
  );

  const handleNearbySearch = useCallback(
    (query: NearbyQuery) => {
      void fetchNearby(query);
      setSelectedCategory(null); // clear filter on new search
      flySeqRef.current += 1;
      setFlyToTarget({ lat: query.lat, lng: query.lng, zoom: radiusToZoom(query.radius), seq: flySeqRef.current });
    },
    [fetchNearby],
  );

  const handleLoadCityCategories = useCallback(() => {
    if (cityCategories.length === 0) {
      void fetchCityCategories();
    }
  }, [cityCategories.length, fetchCityCategories]);

  // When a category filter is active, show only matching businesses on the heatmap
  // so the visual emphasis is consistent between heatmap and markers.
  const heatmapBusinesses =
    selectedCategory === null
      ? businesses
      : businesses.filter((b) => b.category === selectedCategory);

  return (
    <div style={{ display: 'flex', height: '100vh', fontFamily: 'system-ui, sans-serif' }}>
      {/* ── Sidebar ── */}
      <aside
        aria-label="Business search controls"
        style={{
          width: sidebarWidth,
          flexShrink: 0,
          backgroundColor: '#fff',
          display: 'flex',
          flexDirection: 'column',
          overflowY: 'auto',
          // Border is replaced by the drag handle so there's no double-border
        }}
      >
        {/* Header */}
        <header style={{ padding: '1rem', borderBottom: '1px solid #e5e7eb', backgroundColor: '#005a9c' }}>
          <h1 style={{ margin: 0, color: '#fff', fontSize: '1.125rem', fontWeight: 700 }}>
            Alberta Business Launchpad
          </h1>
          <p style={{ margin: '0.25rem 0 0', color: '#cce0f5', fontSize: '0.8125rem' }}>
            Calgary Business License Explorer
          </p>
        </header>

        {/* Error banner */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: '#fef2f2',
              borderBottom: '1px solid #fca5a5',
              padding: '0.75rem 1rem',
              fontSize: '0.875rem',
              color: '#7f1d1d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            <button
              onClick={clearError}
              aria-label="Dismiss error"
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7f1d1d', fontSize: '1rem' }}
            >
              ×
            </button>
          </div>
        )}

        {/* Active-filter banner — shown in both tabs so the user always knows a filter is on */}
        {selectedCategory !== null && (
          <div
            role="status"
            aria-live="polite"
            style={{
              backgroundColor: '#fffbeb',
              borderBottom: '1px solid #fde68a',
              padding: '0.5rem 1rem',
              fontSize: '0.8125rem',
              color: '#92400e',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              gap: '0.5rem',
            }}
          >
            <span>
              Filtering:{' '}
              <strong style={{ fontWeight: 600 }}>{selectedCategory}</strong>
            </span>
            <button
              onClick={() => setSelectedCategory(null)}
              aria-label="Clear category filter"
              style={{
                flexShrink: 0,
                background: 'none',
                border: '1px solid #f59e0b',
                borderRadius: 4,
                cursor: 'pointer',
                color: '#92400e',
                fontSize: '0.75rem',
                padding: '0.125rem 0.5rem',
                fontWeight: 600,
              }}
            >
              Clear
            </button>
          </div>
        )}

        {/* Tab navigation */}
        <nav aria-label="Sidebar tabs" style={{ borderBottom: '1px solid #e5e7eb' }}>
          <div role="tablist" style={{ display: 'flex' }}>
            {(['search', 'categories'] as const).map((tab) => (
              <button
                key={tab}
                role="tab"
                aria-selected={activeTab === tab}
                aria-controls={`panel-${tab}`}
                id={`tab-${tab}`}
                onClick={() => setActiveTab(tab)}
                style={{
                  flex: 1,
                  padding: '0.75rem',
                  border: 'none',
                  borderBottom: activeTab === tab ? '2px solid #005a9c' : '2px solid transparent',
                  backgroundColor: 'transparent',
                  cursor: 'pointer',
                  fontSize: '0.875rem',
                  fontWeight: activeTab === tab ? 600 : 400,
                  color: activeTab === tab ? '#005a9c' : '#374151',
                }}
              >
                {tab === 'search' ? 'Proximity Search' : 'Category Gap'}
              </button>
            ))}
          </div>
        </nav>

        {/* Tab panels */}
        <div
          id="panel-search"
          role="tabpanel"
          aria-labelledby="tab-search"
          hidden={activeTab !== 'search'}
          style={{ padding: '1rem' }}
        >
          <ProximitySearch
            onSearch={handleNearbySearch}
            radius={radius}
            onRadiusChange={setRadius}
            selectedCoords={selectedCoords}
            onCoordsChange={setSelectedCoords}
            loading={businessesLoading}
          />
        </div>

        <div
          id="panel-categories"
          role="tabpanel"
          aria-labelledby="tab-categories"
          hidden={activeTab !== 'categories'}
        >
          <CategoryGapPanel
            localBusinesses={businesses}
            cityCategories={cityCategories}
            categoriesLoading={categoriesLoading}
            onLoadCityCategories={handleLoadCityCategories}
            selectedCoords={selectedCoords}
            radius={radius}
            selectedCategory={selectedCategory}
            onSelectCategory={handleSelectCategory}
          />
        </div>

        {/* Status footer */}
        <div
          aria-live="polite"
          style={{
            padding: '0.75rem 1rem',
            marginTop: 'auto',
            borderTop: '1px solid #e5e7eb',
            fontSize: '0.8125rem',
            color: '#6b7280',
          }}
        >
          {businessesLoading
            ? 'Loading…'
            : selectedCategory !== null
              ? `${heatmapBusinesses.length.toLocaleString()} matching — ${businesses.length.toLocaleString()} total${businesses.length >= 500 ? ' (top 500 shown)' : ''}`
              : businesses.length > 0
                ? `${businesses.length.toLocaleString()} business${businesses.length === 1 ? '' : 'es'} shown${businesses.length >= 500 ? ' — top 500 shown' : ''}`
                : selectedCoords
                  ? 'No businesses found in this area.'
                  : 'Search an address or pan the map to load businesses.'}
        </div>
      </aside>

      {/* ── Drag handle ── */}
      <div
        role="separator"
        aria-label="Drag to resize sidebar"
        aria-orientation="vertical"
        onMouseDown={onDragHandleMouseDown}
        onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#93c5fd'; }}
        onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.backgroundColor = '#e5e7eb'; }}
        style={{
          width: 5,
          flexShrink: 0,
          backgroundColor: '#e5e7eb',
          cursor: 'col-resize',
          transition: 'background-color 0.15s',
          zIndex: 10,
        }}
      />

      {/* ── Map ── */}
      <main style={{ flex: 1, position: 'relative', minWidth: 0 }}>
        <MapContainer
          center={CALGARY_CENTER}
          zoom={DEFAULT_ZOOM}
          style={{ height: '100%', width: '100%' }}
          aria-label="Business license map of Calgary"
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapBoundsHandler onBoundsChange={handleBoundsChange} />
          <FlyToController target={flyToTarget} />
          <MapResizer sidebarWidth={sidebarWidth} />
          <BusinessHeatmap businesses={heatmapBusinesses} />
          <HighlightableMarkerLayer businesses={businesses} selectedCategory={selectedCategory} />
        </MapContainer>
      </main>
    </div>
  );
}
