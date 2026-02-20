import request from 'supertest';
import { app } from '../app';

// Set required env vars before loading app
process.env.NODE_ENV = 'test';
process.env.SOCRATA_APP_TOKEN = 'test-token';
process.env.JWT_SECRET = 'test-secret-at-least-32-characters-long!!';

// Mock the CalgaryBusinessLicenseAdapter so tests don't hit Socrata
jest.mock('../adapters/CalgaryBusinessLicenseAdapter', () => {
  return {
    CalgaryBusinessLicenseAdapter: jest.fn().mockImplementation(() => ({
      fetchByBoundingBox: jest.fn().mockResolvedValue([
        {
          id: 'BL-001',
          name: 'Test Business',
          category: 'Food Service',
          licenseType: 'Business',
          status: 'Active',
          lat: 51.0447,
          lng: -114.0719,
          issueDate: '2023-01-15',
          province: 'AB',
          source: 'calgary',
          _raw: { owner_name: 'Jane Doe', business_phone: '403-555-0100' },
        },
      ]),
      fetchByRadius: jest.fn().mockResolvedValue([
        {
          id: 'BL-002',
          name: 'Near Business',
          category: 'Retail',
          licenseType: 'Business',
          status: 'Active',
          lat: 51.045,
          lng: -114.072,
          issueDate: '2022-06-01',
          province: 'AB',
          source: 'calgary',
          _raw: { owner_name: 'John Smith' },
        },
      ]),
      fetchCategories: jest.fn().mockResolvedValue([
        { category: 'Food Service', count: 1250, source: 'calgary' },
        { category: 'Retail', count: 980, source: 'calgary' },
      ]),
    })),
  };
});

describe('Public Routes', () => {
  describe('GET /api/health', () => {
    it('returns 200 with status ok', async () => {
      const res = await request(app).get('/api/health');
      expect(res.status).toBe(200);
      expect(res.body.status).toBe('ok');
    });
  });

  describe('GET /api/v1/businesses', () => {
    const validParams = { north: 51.1, south: 51.0, east: -113.9, west: -114.1 };

    it('returns 200 with business array', async () => {
      const res = await request(app).get('/api/v1/businesses').query(validParams);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].id).toBe('BL-001');
    });

    it('strips PII fields (owner_name) from response', async () => {
      const res = await request(app).get('/api/v1/businesses').query(validParams);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('Jane Doe');
      expect(json).not.toContain('403-555-0100');
      expect(json).not.toContain('_raw');
    });

    it('returns 400 when bounding box params are missing', async () => {
      const res = await request(app).get('/api/v1/businesses').query({ north: 51.1 });
      expect(res.status).toBe(400);
      expect(res.body.error).toBeDefined();
    });

    it('returns 400 for out-of-range coordinates', async () => {
      const res = await request(app)
        .get('/api/v1/businesses')
        .query({ north: 200, south: 51.0, east: -113.9, west: -114.1 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/businesses/nearby', () => {
    const validParams = { lat: 51.0447, lng: -114.0719, radius: 1000 };

    it('returns 200 with nearby businesses', async () => {
      const res = await request(app).get('/api/v1/businesses/nearby').query(validParams);
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
    });

    it('strips PII from nearby results', async () => {
      const res = await request(app).get('/api/v1/businesses/nearby').query(validParams);
      const json = JSON.stringify(res.body);
      expect(json).not.toContain('John Smith');
      expect(json).not.toContain('_raw');
    });

    it('returns 400 when lat/lng are missing', async () => {
      const res = await request(app).get('/api/v1/businesses/nearby').query({ radius: 500 });
      expect(res.status).toBe(400);
    });

    it('returns 400 when radius exceeds maximum', async () => {
      const res = await request(app)
        .get('/api/v1/businesses/nearby')
        .query({ lat: 51.0447, lng: -114.0719, radius: 100_000 });
      expect(res.status).toBe(400);
    });
  });

  describe('GET /api/v1/businesses/categories', () => {
    it('returns 200 with category summaries', async () => {
      const res = await request(app).get('/api/v1/businesses/categories');
      expect(res.status).toBe(200);
      expect(Array.isArray(res.body)).toBe(true);
      expect(res.body[0].category).toBe('Food Service');
      expect(res.body[0].count).toBe(1250);
    });
  });

  describe('Staff endpoint protection', () => {
    it('returns 401 when no token is provided to staff endpoint', async () => {
      const res = await request(app).get('/api/v1/staff/businesses').query({
        north: 51.1,
        south: 51.0,
        east: -113.9,
        west: -114.1,
      });
      expect(res.status).toBe(401);
    });

    it('returns 401 for malformed Authorization header', async () => {
      const res = await request(app)
        .get('/api/v1/staff/businesses')
        .set('Authorization', 'NotBearer token')
        .query({ north: 51.1, south: 51.0, east: -113.9, west: -114.1 });
      expect(res.status).toBe(401);
    });

    it('returns 401 for invalid JWT', async () => {
      const res = await request(app)
        .get('/api/v1/staff/businesses')
        .set('Authorization', 'Bearer invalid.jwt.token')
        .query({ north: 51.1, south: 51.0, east: -113.9, west: -114.1 });
      expect(res.status).toBe(401);
    });
  });

  describe('GET /api/v1/auth/login', () => {
    it('issues JWT tokens for valid credentials', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'staff@gov.ab.ca', password: 'password123' });
      expect(res.status).toBe(200);
      expect(res.body.accessToken).toBeDefined();
      expect(res.body.refreshToken).toBeDefined();
      expect(res.body.tokenType).toBe('Bearer');
    });

    it('returns 400 for invalid email format', async () => {
      const res = await request(app)
        .post('/api/v1/auth/login')
        .send({ email: 'not-an-email', password: 'password123' });
      expect(res.status).toBe(400);
    });
  });
});
