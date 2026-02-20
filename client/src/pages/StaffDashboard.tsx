import { useEffect, useState, useCallback, useMemo, ChangeEvent } from 'react';
import axios, { AxiosError } from 'axios';

// ─── Types ────────────────────────────────────────────────────────────────────

interface StaffBusinessRecord {
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
  /** Full raw Socrata record — contains FOIP-sensitive PII fields */
  raw: Record<string, unknown>;
}

interface StaffDashboardProps {
  accessToken: string;
  email: string;
  /** Signs the user out and navigates to the public map */
  onLogout: () => void;
  /** Navigates back to the public map without signing out */
  onBackToMap: () => void;
}

// ─── Constants ────────────────────────────────────────────────────────────────

/**
 * Default viewport covering Calgary's urban core.
 * Staff can expand this in a future iteration; for MVP it provides a
 * representative sample of the full dataset.
 */
const DEFAULT_BBOX = { north: 51.18, south: 50.88, east: -113.9, west: -114.25 };

const STATUS_STYLES: Record<string, { bg: string; color: string }> = {
  Active: { bg: '#dcfce7', color: '#166534' },
  Inactive: { bg: '#fef3c7', color: '#92400e' },
  Expired: { bg: '#fee2e2', color: '#991b1b' },
};

function statusStyle(status: string): { bg: string; color: string } {
  return STATUS_STYLES[status] ?? { bg: '#f3f4f6', color: '#374151' };
}

function formatDate(raw: string | null | undefined): string {
  if (!raw) return '—';
  try {
    return new Date(raw).toLocaleDateString('en-CA');
  } catch {
    return String(raw);
  }
}

function rawStr(val: unknown): string {
  if (val === null || val === undefined || val === '') return '—';
  return String(val);
}

// ─── Column definitions ───────────────────────────────────────────────────────

const COLUMNS = [
  { key: 'id', label: 'License #', sensitive: false },
  { key: 'name', label: 'Business Name', sensitive: false },
  { key: 'category', label: 'Category', sensitive: false },
  { key: 'status', label: 'Status', sensitive: false },
  { key: 'address', label: 'Address', sensitive: false },
  { key: 'owner', label: 'Owner', sensitive: true },
  { key: 'phone', label: 'Phone', sensitive: true },
  { key: 'issued', label: 'Issued', sensitive: false },
] as const;

// ─── Sub-components ───────────────────────────────────────────────────────────

function FoipBanner(): JSX.Element {
  return (
    <div
      role="alert"
      style={{
        display: 'flex',
        alignItems: 'flex-start',
        gap: '0.75rem',
        backgroundColor: '#fff7ed',
        borderBottom: '2px solid #fb923c',
        padding: '0.75rem 1.5rem',
        fontSize: '0.8125rem',
        color: '#7c2d12',
        lineHeight: 1.5,
      }}
    >
      <span aria-hidden="true" style={{ fontSize: '1.125rem', flexShrink: 0 }}>&#9888;</span>
      <div>
        <strong>RESTRICTED — FOIP Sensitive Data</strong>
        {' '}This view contains personal information protected under the{' '}
        <em>Freedom of Information and Protection of Privacy Act</em> (FOIP).
        Columns marked with a lock icon include owner PII.
        Do not share, export, or screenshot this data without authorization.
        Access is logged for audit purposes.
      </div>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

export function StaffDashboard({
  accessToken,
  email,
  onLogout,
  onBackToMap,
}: StaffDashboardProps): JSX.Element {
  const [businesses, setBusinesses] = useState<StaffBusinessRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [loadedAt, setLoadedAt] = useState<Date | null>(null);

  const loadData = useCallback(async (): Promise<void> => {
    setLoading(true);
    setError(null);
    try {
      const { data } = await axios.get<StaffBusinessRecord[]>('/api/v1/staff/businesses', {
        params: DEFAULT_BBOX,
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      setBusinesses(data);
      setLoadedAt(new Date());
    } catch (err) {
      const axiosErr = err as AxiosError;
      if (axiosErr.response?.status === 401) {
        // Token expired or revoked — force sign-out so the user re-authenticates
        setError('Your session has expired. Please sign in again.');
        // Give the user a moment to see the message before redirecting
        setTimeout(onLogout, 2000);
      } else {
        setError('Unable to load staff data. Please try again or contact support.');
      }
    } finally {
      setLoading(false);
    }
  }, [accessToken, onLogout]);

  useEffect(() => {
    void loadData();
  }, [loadData]);

  // Client-side filter — applied to name, category, id, and status
  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return businesses;
    return businesses.filter(
      (b) =>
        b.name.toLowerCase().includes(q) ||
        b.category.toLowerCase().includes(q) ||
        b.id.toLowerCase().includes(q) ||
        b.status.toLowerCase().includes(q) ||
        rawStr(b.raw.address).toLowerCase().includes(q),
    );
  }, [businesses, searchQuery]);

  const { bg: activeStatusBg, color: activeStatusColor } = statusStyle('Active');

  return (
    <div style={{ fontFamily: 'system-ui, sans-serif', minHeight: '100vh', backgroundColor: '#f9fafb', display: 'flex', flexDirection: 'column' }}>

      {/* ── Top navigation ── */}
      <header
        style={{
          backgroundColor: '#005a9c',
          color: '#fff',
          padding: '0.75rem 1.5rem',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem' }}>
          <span style={{ fontWeight: 700, fontSize: '1.0625rem' }}>Alberta Business Launchpad</span>
          <span
            style={{
              backgroundColor: '#dc2626',
              color: '#fff',
              fontSize: '0.6875rem',
              fontWeight: 700,
              padding: '0.125rem 0.375rem',
              borderRadius: 3,
              textTransform: 'uppercase',
              letterSpacing: '0.05em',
            }}
          >
            Staff Only
          </span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', fontSize: '0.875rem' }}>
          <span aria-label={`Signed in as ${email}`} style={{ color: '#cce0f5' }}>{email}</span>
          <button
            onClick={onBackToMap}
            aria-label="Back to public map"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              borderRadius: 4,
              padding: '0.375rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            ← Public Map
          </button>
          <button
            onClick={onLogout}
            aria-label="Sign out"
            style={{
              backgroundColor: 'transparent',
              border: '1px solid rgba(255,255,255,0.4)',
              color: '#fff',
              borderRadius: 4,
              padding: '0.375rem 0.75rem',
              cursor: 'pointer',
              fontSize: '0.8125rem',
            }}
          >
            Sign out
          </button>
        </div>
      </header>

      {/* ── FOIP warning ── */}
      <FoipBanner />

      {/* ── Main content ── */}
      <main style={{ padding: '1.5rem', flex: 1 }}>

        {/* Toolbar */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            marginBottom: '1rem',
            gap: '1rem',
            flexWrap: 'wrap',
          }}
        >
          <h1 style={{ margin: 0, fontSize: '1.125rem', fontWeight: 700, color: '#111827' }}>
            Calgary Business Licenses — Full Dataset
          </h1>

          <div style={{ display: 'flex', gap: '0.625rem', alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Search filter */}
            <label htmlFor="staff-search" style={{ position: 'absolute', width: 1, height: 1, overflow: 'hidden', clip: 'rect(0,0,0,0)' }}>
              Filter records
            </label>
            <input
              id="staff-search"
              type="search"
              placeholder="Filter by name, category, status…"
              value={searchQuery}
              onChange={(e: ChangeEvent<HTMLInputElement>) => setSearchQuery(e.target.value)}
              style={{
                padding: '0.5rem 0.75rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
                width: 280,
                boxSizing: 'border-box',
              }}
            />
            <button
              onClick={() => void loadData()}
              disabled={loading}
              aria-busy={loading}
              style={{
                backgroundColor: '#005a9c',
                color: '#fff',
                border: 'none',
                borderRadius: 4,
                padding: '0.5rem 1rem',
                cursor: loading ? 'not-allowed' : 'pointer',
                fontSize: '0.875rem',
                opacity: loading ? 0.7 : 1,
                whiteSpace: 'nowrap',
              }}
            >
              {loading ? 'Refreshing…' : 'Refresh'}
            </button>
          </div>
        </div>

        {/* Record count + load timestamp */}
        {!loading && businesses.length > 0 && (
          <p style={{ margin: '0 0 0.75rem', fontSize: '0.8125rem', color: '#6b7280' }}>
            Showing{' '}
            <strong style={{ color: '#111827' }}>{filtered.length.toLocaleString()}</strong>
            {filtered.length !== businesses.length && (
              <> of <strong style={{ color: '#111827' }}>{businesses.length.toLocaleString()}</strong></>
            )}{' '}
            records — Calgary urban core
            {loadedAt && (
              <> · Loaded {loadedAt.toLocaleTimeString('en-CA', { hour: '2-digit', minute: '2-digit' })}</>
            )}
          </p>
        )}

        {/* Error state */}
        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 4,
              padding: '0.75rem 1rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#7f1d1d',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
            }}
          >
            <span>{error}</span>
            {!error.includes('expired') && (
              <button
                onClick={() => setError(null)}
                aria-label="Dismiss error"
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#7f1d1d', fontSize: '1rem' }}
              >
                ×
              </button>
            )}
          </div>
        )}

        {/* Loading spinner */}
        {loading && (
          <div
            aria-live="polite"
            aria-busy="true"
            style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', color: '#6b7280', fontSize: '0.875rem', marginBottom: '1rem' }}
          >
            <span
              aria-hidden="true"
              style={{
                display: 'inline-block',
                width: 16,
                height: 16,
                border: '2px solid #d1d5db',
                borderTopColor: '#005a9c',
                borderRadius: '50%',
                animation: 'spin 0.7s linear infinite',
              }}
            />
            Loading business records…
            <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
          </div>
        )}

        {/* Empty state after load */}
        {!loading && businesses.length === 0 && !error && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            No records found in the default viewport. Click <strong>Refresh</strong> to retry.
          </p>
        )}

        {/* No filter results */}
        {!loading && businesses.length > 0 && filtered.length === 0 && (
          <p style={{ color: '#6b7280', fontSize: '0.875rem' }}>
            No records match <strong>&quot;{searchQuery}&quot;</strong>. Try a different search term.
          </p>
        )}

        {/* Data table */}
        {!loading && filtered.length > 0 && (
          <div style={{ overflowX: 'auto', borderRadius: 6, border: '1px solid #e5e7eb' }}>
            <table
              aria-label="Staff business license data — includes FOIP-sensitive fields"
              style={{
                width: '100%',
                borderCollapse: 'collapse',
                fontSize: '0.8125rem',
                backgroundColor: '#fff',
              }}
            >
              <thead style={{ backgroundColor: '#f3f4f6' }}>
                <tr>
                  {COLUMNS.map((col) => (
                    <th
                      key={col.key}
                      scope="col"
                      style={{
                        padding: '0.625rem 0.75rem',
                        textAlign: 'left',
                        fontWeight: 600,
                        color: '#374151',
                        borderBottom: '1px solid #e5e7eb',
                        whiteSpace: 'nowrap',
                      }}
                    >
                      {col.label}
                      {col.sensitive && (
                        <span
                          aria-label="FOIP-sensitive field"
                          title="FOIP-sensitive — contains personal information"
                          style={{ marginLeft: '0.25rem', fontSize: '0.6875rem' }}
                        >
                          &#128274;
                        </span>
                      )}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {filtered.map((b, idx) => {
                  const { bg, color } = statusStyle(b.status);
                  return (
                    <tr
                      key={b.id}
                      style={{
                        backgroundColor: idx % 2 === 0 ? '#fff' : '#f9fafb',
                        borderBottom: '1px solid #e5e7eb',
                      }}
                    >
                      {/* License # */}
                      <td style={{ padding: '0.5rem 0.75rem', fontFamily: 'monospace', fontSize: '0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {b.id}
                      </td>

                      {/* Business Name */}
                      <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500, color: '#111827', maxWidth: 220 }}>
                        {b.name}
                      </td>

                      {/* Category */}
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151', maxWidth: 160 }}>
                        {b.category}
                      </td>

                      {/* Status badge */}
                      <td style={{ padding: '0.5rem 0.75rem', whiteSpace: 'nowrap' }}>
                        <span
                          style={{
                            backgroundColor: bg,
                            color,
                            padding: '0.125rem 0.5rem',
                            borderRadius: 9999,
                            fontSize: '0.75rem',
                            fontWeight: 500,
                          }}
                        >
                          {b.status}
                        </span>
                      </td>

                      {/* Address — from raw Socrata record */}
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151', maxWidth: 200 }}>
                        {rawStr(b.raw.address)}
                      </td>

                      {/* Owner — FOIP-sensitive PII */}
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151' }}>
                        {rawStr(b.raw.owner_name)}
                      </td>

                      {/* Phone — FOIP-sensitive PII */}
                      <td style={{ padding: '0.5rem 0.75rem', color: '#374151', whiteSpace: 'nowrap' }}>
                        {rawStr(b.raw.business_phone)}
                      </td>

                      {/* Issue date */}
                      <td style={{ padding: '0.5rem 0.75rem', color: '#6b7280', whiteSpace: 'nowrap' }}>
                        {formatDate(b.issueDate)}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </main>

      {/* ── Footer ── */}
      <footer
        style={{
          padding: '0.75rem 1.5rem',
          borderTop: '1px solid #e5e7eb',
          fontSize: '0.75rem',
          color: '#9ca3af',
          display: 'flex',
          justifyContent: 'space-between',
          flexWrap: 'wrap',
          gap: '0.25rem',
          backgroundColor: '#fff',
        }}
      >
        <span>Source: City of Calgary Open Data — Business Licences (vdjc-pybd) via GoA proxy</span>
        <span>
          Active:{' '}
          <strong style={{ color: activeStatusColor, backgroundColor: activeStatusBg, padding: '0 0.3rem', borderRadius: 3 }}>
            {businesses.filter((b) => b.status === 'Active').length.toLocaleString()}
          </strong>
          {' '}/ {businesses.length.toLocaleString()} loaded
        </span>
      </footer>
    </div>
  );
}
