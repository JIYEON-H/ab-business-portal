# Alberta Business Launchpad

A public-sector digital service that transforms raw Calgary Business License open data (Socrata dataset `vdjc-pybd`) into actionable location-based insights for entrepreneurs and Government of Alberta staff.

---

## Features

- **Interactive Heatmap** — Visualize business density across Calgary using Leaflet + OpenStreetMap
- **Proximity Search** — Find businesses within a configurable radius of any coordinate
- **Category Gap Analysis** — Explore business type breakdowns to identify market opportunities
- **Staff Dashboard** — JWT-authenticated GoA staff view with full dataset access (including PII fields)
- **FOIP Compliance** — Public API strictly whitelists fields; owner PII never leaves the server on public endpoints
- **Redis Caching** — 1-hour TTL cache-aside pattern prevents Socrata rate limit exhaustion
- **WCAG 2.1 AA** — All interactive elements keyboard-navigable with proper ARIA labels

---

## Architecture

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
│  Auth Middleware (JWT) │ Rate Limiter │ Helmet.js         │
│  Public transformer (whitelist) / Staff transformer      │
│  CacheService (Redis-first, in-memory fallback)          │
│  DataSourceAdapter → CalgaryBusinessLicenseAdapter       │
└──────────────────────────────────────────────────────────┘
                         │ HTTPS (App Token)
┌──────────────────────────────────────────────────────────┐
│     Socrata Open Data API — Calgary vdjc-pybd            │
└──────────────────────────────────────────────────────────┘
```

**Stack:** React 18 + Vite · Express.js · TypeScript strict · Redis · Leaflet · Docker · GitHub Actions → Azure Container Apps

---

## Running with Docker

### Prerequisites

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) installed and running
- A free Socrata app token ([register here](https://data.calgary.ca/profile/app_tokens))

### 1. Clone and configure

```bash
git clone <repo-url> ab-business-portal
cd ab-business-portal

# Copy the example env file and fill in your values
cp .env.example .env
```

Open `.env` and set at minimum:

```dotenv
SOCRATA_APP_TOKEN=your_socrata_app_token_here
JWT_SECRET=replace_with_a_long_random_secret_minimum_32_chars
```

Generate a strong JWT secret with:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('hex'))"
```

### 2. Start all services

```bash
docker-compose up --build
```

This starts three containers:

| Service | URL | Description |
|---------|-----|-------------|
| `client` | http://localhost:3000 | React frontend |
| `server` | http://localhost:4000 | Express API proxy |
| `redis` | localhost:6379 | Cache layer |

### 3. Verify it's working

```bash
# Health check
curl http://localhost:4000/api/health

# Public API — businesses near downtown Calgary (no auth required)
curl "http://localhost:4000/api/v1/businesses/nearby?lat=51.0447&lng=-114.0719&radius=1000"

# Cache status
curl http://localhost:4000/api/health/cache
```

### 4. Stop the services

```bash
docker-compose down
```

To also remove the Redis data volume:

```bash
docker-compose down -v
```

---

## Local Development (without Docker)

### Requirements

- Node.js 20+
- Redis running locally (`redis-server` or via Docker: `docker run -p 6379:6379 redis:7-alpine`)

### Server

```bash
cd server
npm install
cp ../.env.example .env   # edit with your values
npm run dev               # starts on http://localhost:4000
```

### Client

```bash
cd client
npm install
npm run dev               # starts on http://localhost:3000
                          # API calls are proxied to :4000
```

### Tests

```bash
cd server
npm test               # run all tests
npm run test:coverage  # with coverage report
```

---

## API Reference

### Public Endpoints (no authentication)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `GET` | `/api/health` | Server health check |
| `GET` | `/api/health/cache` | Cache backend status |
| `GET` | `/api/v1/businesses?north=&south=&east=&west=` | Businesses in bounding box |
| `GET` | `/api/v1/businesses/nearby?lat=&lng=&radius=` | Businesses within radius (metres) |
| `GET` | `/api/v1/businesses/categories` | Category counts for gap analysis |

### Staff Endpoints (JWT required)

| Method | Endpoint | Description |
|--------|----------|-------------|
| `POST` | `/api/v1/auth/login` | Issue JWT tokens `{ email, password }` |
| `POST` | `/api/v1/auth/refresh` | Refresh access token `{ refreshToken }` |
| `GET` | `/api/v1/staff/businesses?north=&south=&east=&west=` | Full dataset including PII fields |

Pass the access token as: `Authorization: Bearer <token>`

---

## Project Structure

```
ab-business-portal/
├── server/
│   ├── src/
│   │   ├── adapters/
│   │   │   ├── DataSourceAdapter.ts          # Interface for pluggable data sources
│   │   │   └── CalgaryBusinessLicenseAdapter.ts  # Socrata vdjc-pybd implementation
│   │   ├── services/
│   │   │   └── CacheService.ts              # Redis-first, in-memory fallback
│   │   ├── transformers/
│   │   │   ├── publicBusinessTransformer.ts # FOIP whitelist — strips all PII
│   │   │   └── staffBusinessTransformer.ts  # Full payload for authenticated staff
│   │   ├── routes/
│   │   │   ├── public.routes.ts             # Unauthenticated endpoints
│   │   │   └── staff.routes.ts              # JWT-protected endpoints + auth
│   │   ├── middleware/
│   │   │   └── jwtAuth.middleware.ts        # JWT verification + role check
│   │   ├── config/
│   │   │   └── env.ts                       # Zod-validated environment schema
│   │   └── app.ts                           # Express entry point
│   ├── Dockerfile
│   ├── tsconfig.json
│   └── package.json
├── client/
│   ├── src/
│   │   ├── components/MapView/
│   │   │   ├── index.tsx                    # Main map layout + tab navigation
│   │   │   ├── BusinessHeatmap.tsx          # Leaflet heatmap layer
│   │   │   ├── ProximitySearch.tsx          # Radius search form (WCAG AA)
│   │   │   └── CategoryGapPanel.tsx         # Business type breakdown
│   │   ├── pages/
│   │   │   ├── StaffLogin.tsx               # GoA staff login form
│   │   │   └── StaffDashboard.tsx           # Full dataset table view
│   │   ├── hooks/
│   │   │   ├── useBusinessData.ts           # Public API data fetching
│   │   │   └── useAuth.ts                   # JWT login/logout state
│   │   ├── types/
│   │   │   └── business.ts                  # Shared TypeScript interfaces
│   │   ├── App.tsx
│   │   └── main.tsx
│   ├── Dockerfile
│   ├── nginx.conf
│   ├── tsconfig.json
│   └── package.json
├── .github/workflows/
│   └── ci-cd.yml                            # Lint → Test → Build → Azure deploy
├── docker-compose.yml
├── .env.example
└── .gitignore
```

---

## Security & Compliance Notes

| Concern | Implementation |
|---------|---------------|
| **FOIP** | `publicBusinessTransformer` whitelists exactly 10 fields; `_raw` payload never sent to public |
| **XSS** | JWT access token stored in memory only (not `localStorage`); Helmet.js CSP headers |
| **Rate limiting** | `express-rate-limit` — 100 req/min per IP on all `/api/` routes |
| **Secrets** | Never committed; loaded from environment variables; production uses Azure Key Vault |
| **Transport** | HSTS enabled via Helmet (`max-age=31536000; includeSubDomains; preload`) |
| **Container** | Non-root user in Docker image (GoA/CIS hardening) |

---

## Extending to Other Cities

The `DataSourceAdapter` interface in `server/src/adapters/DataSourceAdapter.ts` is designed for Alberta-wide expansion. To add Edmonton:

```typescript
// server/src/adapters/EdmontonBusinessLicenseAdapter.ts
import { DataSourceAdapter, BusinessRecord, ... } from './DataSourceAdapter';

export class EdmontonBusinessLicenseAdapter implements DataSourceAdapter {
  readonly sourceId = 'edmonton';
  // Implement fetchByBoundingBox(), fetchByRadius(), fetchCategories()
}
```

No changes required to the cache, transformer, or routing layers.

---

## CI/CD

GitHub Actions runs on every push to `main`:

1. **Lint + Type-check** — ESLint + `tsc --noEmit` on server and client
2. **Tests** — Jest + Supertest with Redis service container (32 tests)
3. **Docker build** — Images pushed to GitHub Container Registry
4. **Azure deploy** — Container Apps updated via `azure/container-apps-deploy-action`

Secrets required in GitHub: `AZURE_CREDENTIALS`, `ACR_NAME`, `AZURE_RESOURCE_GROUP`
