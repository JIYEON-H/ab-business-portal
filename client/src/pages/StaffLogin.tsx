import { FormEvent, useState } from 'react';

interface StaffLoginProps {
  onLogin: (email: string, password: string) => Promise<void>;
  loading: boolean;
  error: string | null;
}

export function StaffLogin({ onLogin, loading, error }: StaffLoginProps): JSX.Element {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: FormEvent): void {
    e.preventDefault();
    void onLogin(email, password);
  }

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        backgroundColor: '#f3f4f6',
        fontFamily: 'system-ui, sans-serif',
      }}
    >
      <div
        style={{
          backgroundColor: '#fff',
          borderRadius: 8,
          padding: '2rem',
          width: '100%',
          maxWidth: 400,
          boxShadow: '0 1px 3px rgba(0,0,0,0.12)',
        }}
      >
        {/* GoA branding */}
        <header style={{ textAlign: 'center', marginBottom: '1.5rem' }}>
          <div
            aria-hidden="true"
            style={{
              width: 48,
              height: 48,
              backgroundColor: '#005a9c',
              borderRadius: 8,
              margin: '0 auto 0.75rem',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#fff',
              fontSize: '1.5rem',
              fontWeight: 700,
            }}
          >
            AB
          </div>
          <h1 style={{ margin: 0, fontSize: '1.25rem', fontWeight: 700, color: '#111827' }}>
            GoA Staff Portal
          </h1>
          <p style={{ margin: '0.25rem 0 0', fontSize: '0.875rem', color: '#6b7280' }}>
            Alberta Business Launchpad — Restricted Access
          </p>
        </header>

        {error && (
          <div
            role="alert"
            aria-live="assertive"
            style={{
              backgroundColor: '#fef2f2',
              border: '1px solid #fca5a5',
              borderRadius: 4,
              padding: '0.75rem',
              marginBottom: '1rem',
              fontSize: '0.875rem',
              color: '#7f1d1d',
            }}
          >
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} noValidate>
          <div style={{ marginBottom: '1rem' }}>
            <label
              htmlFor="email"
              style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}
            >
              GoA Email Address
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              aria-describedby="email-hint"
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
            <span id="email-hint" style={{ fontSize: '0.75rem', color: '#6b7280', display: 'block', marginTop: '0.25rem' }}>
              Use your @gov.ab.ca email address
            </span>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <label
              htmlFor="password"
              style={{ display: 'block', marginBottom: '0.375rem', fontSize: '0.875rem', fontWeight: 500, color: '#374151' }}
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                width: '100%',
                padding: '0.625rem',
                border: '1px solid #d1d5db',
                borderRadius: 4,
                fontSize: '0.875rem',
                boxSizing: 'border-box',
              }}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            aria-busy={loading}
            style={{
              width: '100%',
              padding: '0.75rem',
              backgroundColor: loading ? '#93c5fd' : '#005a9c',
              color: '#fff',
              border: 'none',
              borderRadius: 4,
              fontSize: '0.9375rem',
              fontWeight: 600,
              cursor: loading ? 'not-allowed' : 'pointer',
            }}
          >
            {loading ? 'Signing in…' : 'Sign In'}
          </button>
        </form>

        <p style={{ marginTop: '1.5rem', textAlign: 'center', fontSize: '0.8125rem', color: '#6b7280' }}>
          Access restricted to authorized Government of Alberta employees.
        </p>
      </div>
    </main>
  );
}
