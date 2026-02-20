import { toPublicRecord, toPublicRecords } from './publicBusinessTransformer';
import { BusinessRecord } from '../adapters/DataSourceAdapter';

const fullRecord: BusinessRecord = {
  id: 'BL-001',
  name: 'Acme Coffee Co',
  category: 'Food Service',
  licenseType: 'Business',
  status: 'Active',
  lat: 51.0447,
  lng: -114.0719,
  issueDate: '2023-01-15',
  province: 'AB',
  source: 'calgary',
  _raw: {
    owner_name: 'Jane Doe',
    business_address: '123 Main St SW',
    business_phone: '403-555-0100',
    license_number: 'BL-001',
  },
};

describe('publicBusinessTransformer', () => {
  describe('toPublicRecord', () => {
    it('returns all whitelisted fields', () => {
      const result = toPublicRecord(fullRecord);
      expect(result.id).toBe('BL-001');
      expect(result.name).toBe('Acme Coffee Co');
      expect(result.category).toBe('Food Service');
      expect(result.licenseType).toBe('Business');
      expect(result.status).toBe('Active');
      expect(result.lat).toBe(51.0447);
      expect(result.lng).toBe(-114.0719);
      expect(result.issueDate).toBe('2023-01-15');
      expect(result.province).toBe('AB');
      expect(result.source).toBe('calgary');
    });

    it('strips _raw (PII payload)', () => {
      const result = toPublicRecord(fullRecord);
      expect('_raw' in result).toBe(false);
    });

    it('strips owner_name from output', () => {
      const result = toPublicRecord(fullRecord);
      expect(JSON.stringify(result)).not.toContain('Jane Doe');
    });

    it('strips business_phone from output', () => {
      const result = toPublicRecord(fullRecord);
      expect(JSON.stringify(result)).not.toContain('403-555-0100');
    });

    it('strips business_address from output', () => {
      const result = toPublicRecord(fullRecord);
      expect(JSON.stringify(result)).not.toContain('123 Main St SW');
    });

    it('handles null lat/lng gracefully', () => {
      const result = toPublicRecord({ ...fullRecord, lat: null, lng: null });
      expect(result.lat).toBeNull();
      expect(result.lng).toBeNull();
    });
  });

  describe('toPublicRecords', () => {
    it('maps an array of records', () => {
      const records = [fullRecord, { ...fullRecord, id: 'BL-002' }];
      const result = toPublicRecords(records);
      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('BL-001');
      expect(result[1].id).toBe('BL-002');
    });

    it('strips PII from every record in the array', () => {
      const records = [fullRecord, { ...fullRecord, id: 'BL-002' }];
      const json = JSON.stringify(toPublicRecords(records));
      expect(json).not.toContain('Jane Doe');
      expect(json).not.toContain('403-555-0100');
    });
  });
});
