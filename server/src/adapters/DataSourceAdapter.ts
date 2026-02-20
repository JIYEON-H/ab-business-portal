/**
 * DataSourceAdapter — interface for pluggable municipal business-license data sources.
 *
 * Calgary ships at MVP; additional cities (Edmonton, Red Deer, …) implement
 * this interface without touching any service-layer code.
 */

export interface BoundingBox {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface RadiusQuery {
  lat: number;
  lng: number;
  /** Radius in metres */
  radiusMetres: number;
  limit?: number;
}

export interface CategoryQuery {
  area?: string;
  limit?: number;
}

/** Minimal public-safe business record returned by adapters */
export interface BusinessRecord {
  id: string;
  name: string;
  category: string;
  licenseType: string;
  status: string;
  lat: number | null;
  lng: number | null;
  /** ISO-8601 date string */
  issueDate: string | null;
  /** Two-letter province code */
  province: string;
  /** Source system identifier, e.g. "calgary" */
  source: string;
  /** Raw payload preserved for staff endpoints */
  _raw?: Record<string, unknown>;
}

export interface CategorySummary {
  category: string;
  count: number;
  source: string;
}

export interface DataSourceAdapter {
  /** Human-readable identifier, e.g. "calgary" */
  readonly sourceId: string;

  fetchByBoundingBox(bbox: BoundingBox, limit?: number): Promise<BusinessRecord[]>;
  fetchByRadius(query: RadiusQuery): Promise<BusinessRecord[]>;
  fetchCategories(query: CategoryQuery): Promise<CategorySummary[]>;
}
