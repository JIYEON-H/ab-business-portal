import axios, { AxiosInstance } from 'axios';
import axiosRetry from 'axios-retry';
import {
  BoundingBox,
  BusinessRecord,
  CategoryQuery,
  CategorySummary,
  DataSourceAdapter,
  RadiusQuery,
} from './DataSourceAdapter';
import { env } from '../config/env';

/** Raw shape returned by Socrata vdjc-pybd */
interface SocrataRecord {
  getbusid?: string;
  tradename?: string;
  address?: string;
  licencetypes?: string;
  jobstatusdesc?: string;
  first_iss_dt?: string;

  point?: {
    type: string;
    coordinates: [number, number]; // [lng, lat]
  };

  [key: string]: unknown;
}

const SOCRATA_PAGE_LIMIT = 1000;

export class CalgaryBusinessLicenseAdapter implements DataSourceAdapter {
  readonly sourceId = 'calgary';
  private readonly client: AxiosInstance;

  constructor(baseUrl = env.SOCRATA_BASE_URL, appToken = env.SOCRATA_APP_TOKEN) {
    this.client = axios.create({
      baseURL: baseUrl,
      timeout: 10_000,
      headers: {
        'X-App-Token': appToken,
        Accept: 'application/json',
      },
    });

    axiosRetry(this.client, {
      retries: 3,
      retryDelay: axiosRetry.exponentialDelay,
      retryCondition: (err) => {
        const status = err.response?.status;
        return axiosRetry.isNetworkError(err) || status === 429 || (status !== undefined && status >= 500);
      },
    });
  }

  async fetchByBoundingBox(bbox: BoundingBox, limit = SOCRATA_PAGE_LIMIT): Promise<BusinessRecord[]> {
    const where = `POINT IS NOT NULL AND within_box(POINT, ${bbox.north}, ${bbox.west}, ${bbox.south}, ${bbox.east})`;

    const { data } = await this.client.get<any[]>('', {
      params: {
        $where: where,
        $limit: limit,
        $order: 'FIRST_ISS_DT DESC',
      },
    });

    return data.map((r) => this.toBusinessRecord(r));
  }

  async fetchByRadius(query: RadiusQuery): Promise<BusinessRecord[]> {
    // Socrata supports within_circle(location_field, lat, lng, radius_metres)
    // vdjc-pybd uses a computed location column; fall back to bounding-box approximation
    const { lat, lng, radiusMetres, limit = SOCRATA_PAGE_LIMIT } = query;
    const degreeOffset = radiusMetres / 111_320; // ~1 degree latitude = 111,320m

    const bbox: BoundingBox = {
      north: lat + degreeOffset,
      south: lat - degreeOffset,
      east: lng + degreeOffset / Math.cos((lat * Math.PI) / 180),
      west: lng - degreeOffset / Math.cos((lat * Math.PI) / 180),
    };

    const records = await this.fetchByBoundingBox(bbox, limit * 2);

    // Client-side Haversine filter for accuracy within the bounding-box pre-filter
    return records
      .filter((r) => r.lat !== null && r.lng !== null && haversine(lat, lng, r.lat!, r.lng!) <= radiusMetres)
      .slice(0, limit);
  }

  async fetchCategories(query: CategoryQuery): Promise<CategorySummary[]> {
    const { limit = 200 } = query;

    const { data } = await this.client.get<Array<{ licencetypes: string; count: string }>>('', {
      params: {
        $select: 'licencetypes, count(*) AS count',
        $group: 'licencetypes',
        $order: 'count DESC',
        $limit: limit,
      },
    });

    return data
      .filter((r) => r.licencetypes)
      .map((r) => ({
        category: r.licencetypes,
        count: parseInt(r.count, 10),
        source: this.sourceId,
      }));
  }

  private toBusinessRecord(r: SocrataRecord): BusinessRecord {
    let lat: number | null = null;
    let lng: number | null = null;

    if (r.point && r.point.coordinates) {
      lng = r.point.coordinates[0];
      lat = r.point.coordinates[1];
    }

    return {
      id: r.getbusid ?? crypto.randomUUID(),
      name: r.tradename ?? 'Unknown Business',
      category: r.licencetypes ?? 'Uncategorized',
      licenseType: r.licencetypes ?? '',
      status: r.jobstatusdesc ?? 'Active',
      lat: lat,
      lng: lng,
      issueDate: r.first_iss_dt ?? null,
      province: 'AB',
      source: this.sourceId,
      _raw: r,
    };
  }
}

function haversine(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const R = 6_371_000; // Earth radius in metres
  const toRad = (deg: number): number => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}
