# Alberta Business Launchpad — Implementation Plan

## Context

The Government of Alberta needs a public-sector digital service that transforms raw Calgary Business License open data (Socrata dataset `vdjc-pybd`) into actionable location-based insights for entrepreneurs. The system must serve two audiences — anonymous public users and authenticated GoA staff — while respecting FOIP, Socrata rate limits, WCAG 2.1 AA, and GoA Azure deployment standards. The architecture must be Calgary-first but Alberta-wide in design, avoiding future rewrites when new municipal data sources are added.

---

## 1. Clarifying Questions & Answers

| # | Question | Decision |
|---|----------|----------|
| 1 | Who are the primary users? | Both public entrepreneurs (anonymous) and GoA staff (JWT-authenticated) |
| 2 | MVP features? | Map + density heatmap, radius/proximity search, category gap analysis |
| 3 | Geographic scope? | Calgary at MVP; multi-source adapter pattern for Alberta-wide expansion |
| 4 | FOIP / PII handling? | Express proxy whitelist for public API; full dataset behind JWT staff endpoints |
| 5 | Deployment & scale? | Docker + GoA Azure; Redis cache; ~1,000–5,000 concurrent users |

---

## 2. Proposed High-Level Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    React Frontend (TSX)                  │
│  Public View          │          Staff Dashboard         │
│  - Map / Heatmap      │  - Full Data Table               │
│  - Proximity Search   │  - Unmasked Fields               │
│  - Category Gap View  │  - JWT Login Flow                │
└──────────────────────────────────────────────────────────┘
                         │ HTTPS
┌──────────────────────────────────────────────────────────┐
│              Express.js Proxy Server (TypeScript)        │
│                                                          │
│  ┌───────────────┐   ┌────────────────┐                  │
│  │ Auth Middleware│   │ Rate Limiter   │                  │
│  │ (JWT verify)  │   │ (express-rate- │                  │
│  └───────────────┘   │  limit)        │                  │
│                      └────────────────┘                  │
│  ┌───────────────────────────────────────────────────┐   │
│  │           Data Transformation Layer               │   │
│  │  Public: field whitelist (name, category,         │   │
│  │          location, status, license_type)          │   │
│  │  Staff:  full payload (owner PII, contact info)   │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────┐   │
│  │           Cache Service (Redis)                   │   │
│  │  TTL: 1 hour | Key: {source}:{endpoint}:{hash}    │   │
│  │  Cache-aside pattern; miss → Socrata fetch        │   │
│  └───────────────────────────────────────────────────┘   │
│  ┌───────────────────────────────────────────────────┐   │
│  │           Data Source Adapter Layer               │   │
│  │  Interface: DataSourceAdapter                     │   │
│  │  Impl: CalgaryBusinessLicenseAdapter (vdjc-pybd)  │   │
│  │  Future: EdmontonAdapter, RedDeerAdapter, ...     │   │
│  └───────────────────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
                         │ HTTPS (App Token)
┌──────────────────────────────────────────────────────────┐
│            Socrata Open Data API                         │
│            Calgary Business Licenses (vdjc-pybd)         │
└──────────────────────────────────────────────────────────┘

Infrastructure: Docker Compose → GoA Azure Container Apps
Cache: Redis 7 (Azure Cache for Redis)
Secrets: Azure Key Vault (JWT secret, Socrata app token)
```

### Key Architectural Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Proxy pattern | Express middleware chain | Separation of concerns; hides Socrata token; enables FOIP field filtering |
| Caching | Redis (cache-aside, 1h TTL) | Prevents Socrata rate limit exhaustion; reduces latency for peak citizen traffic |
| Auth | JWT (RS256, short-lived access + refresh) | Stateless; Azure-compatible; no session store needed |
| Data source abstraction | `DataSourceAdapter` interface | Calgary MVP ships now; other cities plug in without rewriting service layer |
| Map library | Leaflet + react-leaflet (OpenStreetMap tiles) | Open-source, no per-request licensing cost; GoA-acceptable |
| Container | Docker Compose (dev) → Azure Container Apps (prod) | Consistent environments; GoA Azure alignment |

---

## 3. First Milestone Plan

### Milestone 0 — Project Scaffolding (Week 1)
- [ ] Monorepo structure: `/server` (Express/TS), `/client` (React/TS), `/docker`
- [ ] `docker-compose.yml`: Express + React + Redis services
- [ ] `.env.example` with all required variables (never committed secrets)
- [ ] ESLint + Prettier + TypeScript `strict` mode configured
- [ ] GitHub Actions CI stub (lint + type-check)

**Critical Files:**
- `server/src/app.ts` — Express app entry
- `server/src/config/env.ts` — validated env schema (zod)
- `docker-compose.yml`

---

### Milestone 1 — Backend Proxy + Data Layer (Week 2–3)

#### 1a. Data Source Adapter
```
server/src/adapters/
  DataSourceAdapter.ts        ← interface
  CalgaryBusinessLicenseAdapter.ts  ← Socrata vdjc-pybd impl
```
- Implement `fetchByBoundingBox()`, `fetchByRadius()`, `fetchByCategory()`
- Axios with timeout (10s), retry (3x exponential backoff), circuit breaker

#### 1b. Cache Service
```
server/src/services/CacheService.ts
```
- Redis client (ioredis)
- `get(key)`, `set(key, value, ttlSeconds)`, `invalidate(pattern)`
- Falls back to in-memory (node-cache) if Redis unavailable (dev mode)

#### 1c. Data Transformation Layer (FOIP critical)
```
server/src/transformers/
  publicBusinessTransformer.ts   ← whitelist: name, category, lat, lng, status
  staffBusinessTransformer.ts    ← full payload passthrough with audit log
```

#### 1d. API Routes
```
Public (no auth):
  GET /api/v1/businesses?bbox=...          → heatmap data
  GET /api/v1/businesses/nearby?lat=&lng=&radius=
  GET /api/v1/businesses/categories?area=

Staff (JWT required):
  GET /api/v1/staff/businesses?...         → full payload
  POST /api/v1/auth/login                  → issue JWT
  POST /api/v1/auth/refresh
```

---

### Milestone 2 — Frontend Core (Week 3–4)

#### 2a. Map View (Public)
```
client/src/components/
  MapView/
    BusinessHeatmap.tsx     ← Leaflet heatmap layer
    ProximitySearch.tsx     ← address input + radius slider
    CategoryGapPanel.tsx    ← sidebar with business type breakdown
```
- All map controls keyboard-navigable (WCAG 2.1 AA)
- ARIA labels on all interactive elements
- Color contrast ratio ≥ 4.5:1

#### 2b. Staff Dashboard (JWT-gated)
```
client/src/pages/
  StaffLogin.tsx
  StaffDashboard.tsx
```
- JWT stored in `httpOnly` cookie (not localStorage — XSS mitigation)
- Protected route wrapper component

---

### Milestone 3 — Compliance + Testing (Week 5)

- [ ] Jest unit tests: transformers (PII stripping), cache service, adapter mocks
- [ ] Supertest integration tests: all public + staff endpoints
- [ ] Axe-core accessibility audit on all React components
- [ ] OWASP ZAP scan on Express endpoints
- [ ] FOIP field audit sign-off (legal gate — must complete before public launch)
- [ ] Security headers: Helmet.js (CSP, HSTS, X-Frame-Options)

---

### Milestone 4 — Azure Deployment (Week 6)

- [ ] Azure Container Apps: server + client containers
- [ ] Azure Cache for Redis provisioned
- [ ] Azure Key Vault: JWT secret, Socrata app token
- [ ] GitHub Actions CD pipeline: build → push → deploy
- [ ] Health check endpoints: `GET /api/health`, `GET /api/health/cache`

---

## 4. Risks and Assumptions

| Risk | Likelihood | Mitigation |
|------|-----------|------------|
| Socrata rate limits (429) | High | Redis cache + exponential backoff + circuit breaker. Socrata app token required (free, raises limit to 1,000 req/hr) |
| FOIP field ambiguity | Medium | Legal review gate in Milestone 3. Default to whitelisting; err on the side of stripping more fields |
| Map tile licensing for GoA | Medium | OpenStreetMap / Leaflet is open-source. Avoid Google Maps (per-request billing). Confirm with GoA digital services |
| JWT secret rotation in Azure | Low | Use Azure Key Vault with managed identity; rotate on schedule |
| Calgary dataset schema changes | Low | Adapter layer isolates schema parsing; pin to a specific SoQL field list; add schema validation on startup |
| Alberta Wallet future integration | Planned | Design the JWT auth flow to be replaceable; keep auth as a separate service layer |

### Assumptions
1. The Calgary Business License dataset (`vdjc-pybd`) is public and does not require a data-sharing agreement beyond the Socrata app token.
2. GoA has an existing Azure subscription and Container Apps quota available.
3. A Socrata app token will be provisioned before Milestone 1 begins.
4. WCAG 2.1 Level AA is the minimum; Level AAA is aspirational but not blocking for launch.
5. The JWT issuer is internal GoA for MVP; MyAlberta Digital ID integration is a Phase 2 concern.

---

## 5. File Structure (Target)

```
ab-business-portal/
├── server/
│   ├── src/
│   │   ├── adapters/
│   │   │   ├── DataSourceAdapter.ts
│   │   │   └── CalgaryBusinessLicenseAdapter.ts
│   │   ├── services/
│   │   │   └── CacheService.ts
│   │   ├── transformers/
│   │   │   ├── publicBusinessTransformer.ts
│   │   │   └── staffBusinessTransformer.ts
│   │   ├── routes/
│   │   │   ├── public.routes.ts
│   │   │   └── staff.routes.ts
│   │   ├── middleware/
│   │   │   └── jwtAuth.middleware.ts
│   │   └── app.ts
│   ├── tsconfig.json
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/MapView/
│   │   ├── pages/
│   │   └── App.tsx
│   ├── tsconfig.json
│   └── package.json
├── docker-compose.yml
├── .env.example
└── .github/workflows/ci-cd.yml
```

---

## 6. Verification Plan

1. **Local dev**: `docker-compose up` → Express on :4000, React on :3000, Redis on :6379
2. **Public API smoke test**: `curl http://localhost:4000/api/v1/businesses/nearby?lat=51.0447&lng=-114.0719&radius=1000` → returns whitelist-only fields, no PII
3. **Staff API test**: Request with invalid JWT → 401. Valid JWT → full payload returned
4. **Cache test**: First request hits Socrata (>200ms). Second identical request returns from Redis (<10ms)
5. **Accessibility**: Run `axe` in browser dev tools on Map View — zero violations at AA level
6. **Rate limit test**: Send 50 rapid identical requests → all served from cache, Socrata called once
