export interface PublicBusinessRecord {
  id: string;
  name: string;
  category: string;
  licenseType: string;
  status: string;
  lat: number | null;
  lng: number | null;
  issueDate: string | null;
  province: string;
  source: string;
}

export interface CategorySummary {
  category: string;
  count: number;
  source: string;
}

export interface NearbyQuery {
  lat: number;
  lng: number;
  radius: number;
}

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

/**
 * One row in the gap analysis comparison table.
 * All percentage fields are in 0–100 scale (not 0–1).
 */
export interface CategoryGapEntry {
  category: string;
  /** Count of matching businesses in the local search area */
  localCount: number;
  /** Share of local businesses in this category (%) */
  localPct: number;
  /** Share of Calgary-wide licenses in this category (%) */
  cityPct: number;
  /** localPct − cityPct — negative = under-represented */
  gapPct: number;
  /**
   * ((localPct − cityPct) / cityPct) × 100
   * −60 means "60 % fewer than the city average share"
   */
  relativeGapPct: number;
}

/** Shape returned by the Nominatim /search endpoint (subset of fields we use) */
export interface NominatimSuggestion {
  place_id: number;
  display_name: string;
  /** Returned as string from Nominatim */
  lat: string;
  /** Returned as string from Nominatim */
  lon: string;
  type: string;
  address?: {
    house_number?: string;
    road?: string;
    suburb?: string;
    neighbourhood?: string;
    city?: string;
    town?: string;
    county?: string;
    state?: string;
    postcode?: string;
    country?: string;
  };
}
