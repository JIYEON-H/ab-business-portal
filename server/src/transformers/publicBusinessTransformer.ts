import { BusinessRecord } from '../adapters/DataSourceAdapter';

/**
 * Public-safe business record — FOIP whitelist.
 * Contains NO owner PII, contact information, or business address.
 */
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

/**
 * Strip all fields not on the FOIP whitelist.
 * _raw is always removed; no PII passes through.
 */
export function toPublicRecord(record: BusinessRecord): PublicBusinessRecord {
  return {
    id: record.id,
    name: record.name,
    category: record.category,
    licenseType: record.licenseType,
    status: record.status,
    lat: record.lat,
    lng: record.lng,
    issueDate: record.issueDate,
    province: record.province,
    source: record.source,
    // _raw intentionally excluded
  };
}

export function toPublicRecords(records: BusinessRecord[]): PublicBusinessRecord[] {
  return records.map(toPublicRecord);
}
