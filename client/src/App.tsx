import { useState } from 'react';
import { MapView } from './components/MapView';
import { StaffLogin } from './pages/StaffLogin';
import { StaffDashboard } from './pages/StaffDashboard';
import { useAuth } from './hooks/useAuth';

/**
 * Two top-level views:
 *   'public' — the public-facing map (no auth required)
 *   'staff'  — if not authenticated: shows StaffLogin
 *              if authenticated:     shows StaffDashboard
 *
 * Using view-state rather than URL routing keeps the bundle dependency-free
 * (no react-router) and ensures the staff route is never URL-bookmarkable.
 * Route protection is enforced by the rendering conditions below — the
 * StaffDashboard is unreachable without a valid in-memory accessToken.
 */
type View = 'public' | 'staff';

export function App(): JSX.Element {
  const [view, setView] = useState<View>('public');
  const { auth, login, logout, error: authError, loading: authLoading } = useAuth();

  function handleLogout(): void {
    logout();
    setView('public');
  }

  function handleBackToMap(): void {
    // Navigate to public map without signing out; auth state is preserved so
    // clicking "GoA Staff" again returns directly to the dashboard.
    setView('public');
  }

  // ── Staff route ──────────────────────────────────────────────────────────────
  if (view === 'staff') {
    // Not yet authenticated → show login.
    // The login form calls `login()` directly; the re-render after successful
    // authentication flips auth.isAuthenticated to true, which falls through
    // to the dashboard branch below on the very next render cycle.
    // Navigating inside the onLogin callback is intentionally avoided to
    // prevent the stale-closure bug (authError captured at render time would
    // always be null inside the callback).
    if (!auth.isAuthenticated) {
      return (
        <StaffLogin
          onLogin={login}
          loading={authLoading}
          error={authError}
        />
      );
    }

    // Authenticated → show the dashboard.  accessToken and email are
    // guaranteed non-null here because isAuthenticated is true.
    return (
      <StaffDashboard
        accessToken={auth.accessToken!}
        email={auth.email!}
        onLogout={handleLogout}
        onBackToMap={handleBackToMap}
      />
    );
  }

  // ── Public route ─────────────────────────────────────────────────────────────
  return (
    <div style={{ position: 'relative', height: '100vh' }}>
      <MapView />
      {/* Unobtrusive staff-access entry point — no visual prominence so it
          doesn't invite unauthorized access attempts */}
      <button
        onClick={() => setView('staff')}
        aria-label="GoA Staff Login"
        style={{
          position: 'absolute',
          bottom: '1rem',
          right: '1rem',
          zIndex: 1000,
          backgroundColor: '#fff',
          border: '1px solid #d1d5db',
          borderRadius: 4,
          padding: '0.375rem 0.75rem',
          fontSize: '0.75rem',
          color: '#6b7280',
          cursor: 'pointer',
          boxShadow: '0 1px 2px rgba(0,0,0,0.08)',
        }}
      >
        {auth.isAuthenticated ? 'Staff Dashboard' : 'GoA Staff'}
      </button>
    </div>
  );
}
