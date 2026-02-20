import { BusinessRecord } from '../adapters/DataSourceAdapter';

/**
 * Full staff record — includes raw Socrata payload and PII fields.
 * MUST only be sent to JWT-authenticated staff endpoints.
 */
export interface StaffBusinessRecord extends Omit<BusinessRecord, '_raw'> {
  // All public fields plus raw payload for staff
  raw: Record<string, unknown>;
}

export function toStaffRecord(record: BusinessRecord): StaffBusinessRecord {
  const { _raw, ...rest } = record;
  return {
    ...rest,
    raw: _raw ?? {},
  };
}

export function toStaffRecords(records: BusinessRecord[]): StaffBusinessRecord[] {
  return records.map(toStaffRecord);
}
