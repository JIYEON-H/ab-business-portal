import { useEffect, useRef } from 'react';
import { useMap } from 'react-leaflet';
import { PublicBusinessRecord } from '../../types/business';

interface BusinessHeatmapProps {
  businesses: PublicBusinessRecord[];
}

interface HeatLayer {
  addTo(map: import('leaflet').Map): this;
  remove(): void;
  setLatLngs(latlngs: [number, number, number][]): void;
}

interface LeafletWithHeat {
  heatLayer(latlngs: [number, number, number][], options?: Record<string, unknown>): HeatLayer;
}

/**
 * Leaflet heatmap layer rendered from business location data.
 * Requires leaflet.heat to be loaded.
 */
export function BusinessHeatmap({ businesses }: BusinessHeatmapProps): null {
  const map = useMap();
  const heatLayerRef = useRef<HeatLayer | null>(null);

  useEffect(() => {
    const L = window.L as unknown as LeafletWithHeat;
    if (!L || typeof L.heatLayer !== 'function') return;

    const points: [number, number, number][] = businesses
      .filter((b) => b.lat !== null && b.lng !== null)
      .map((b) => [b.lat as number, b.lng as number, 0.5]);

    if (heatLayerRef.current) {
      heatLayerRef.current.setLatLngs(points);
    } else {
      heatLayerRef.current = L.heatLayer(points, {
        radius: 25,
        blur: 15,
        maxZoom: 17,
        gradient: { 0.4: '#4575b4', 0.65: '#fee090', 1: '#d73027' },
      }).addTo(map);
    }

    return () => {
      if (heatLayerRef.current) {
        heatLayerRef.current.remove();
        heatLayerRef.current = null;
      }
    };
  }, [map, businesses]);

  return null;
}

declare global {
  interface Window {
    L: unknown;
  }
}
