'use client';

import { useEffect, useState } from 'react';
import { adminFetchInit } from '@/lib/admin-fetch';
import { DRIVER_SESSION_PUBLIC_COOKIE_NAME } from '@/lib/session-constants';

type DebugUser = {
  id: string;
  email: string;
  role: string;
  driver_status: string | null;
};

type DebugResponse = {
  postgresHostFromEnv: string | null;
  detailLevel: 'full' | 'limited';
  requestTokenFound: boolean;
  requestJwtSubject_unverified: string | null;
  requestJwtEmail_unverified: string | null;
  dbUserForRequestJwtSubject: DebugUser | null;
  getCurrentUserFromRequest: DebugUser | null;
  getCurrentUser: DebugUser | null;
  mismatch_notes: string[];
};

function hasReadableEchoCookie(): boolean {
  if (typeof document === 'undefined') return false;
  const prefix = `${DRIVER_SESSION_PUBLIC_COOKIE_NAME}=`;
  return document.cookie.split('; ').some((row) => row.startsWith(prefix));
}

export default function AdminAuthDiagnostics() {
  const [data, setData] = useState<DebugResponse | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [echoCookiePresent, setEchoCookiePresent] = useState(false);

  async function refreshDiagnostics(): Promise<void> {
    setLoading(true);
    setError(null);
    setEchoCookiePresent(hasReadableEchoCookie());
    try {
      const res = await fetch('/api/admin/auth-debug', adminFetchInit());
      const body = (await res.json()) as DebugResponse | { error?: string };
      if (!res.ok) {
        setData(null);
        setError(('error' in body && body.error) || `HTTP ${res.status}`);
        return;
      }
      setData(body as DebugResponse);
    } catch (e) {
      setData(null);
      setError(e instanceof Error ? e.message : 'Failed to load diagnostics.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    void refreshDiagnostics();
  }, []);

  return (
    <section className="hairline rounded bg-white p-4 mb-8">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
            Admin auth diagnostics
          </div>
          <p className="text-sm text-[var(--color-muted)] max-w-2xl">
            This checks what the browser can send from this tab and what the admin API auth path resolves on the server.
          </p>
        </div>
        <button type="button" className="btn btn-ghost" onClick={() => void refreshDiagnostics()} disabled={loading}>
          {loading ? 'Checking…' : 'Refresh diagnostics'}
        </button>
      </div>

      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4 mt-4">
        <Tile label="Browser origin" value={typeof window === 'undefined' ? 'Loading…' : window.location.origin} />
        <Tile
          label="Readable echo cookie"
          value={echoCookiePresent ? 'Present' : 'Missing'}
          tone={echoCookiePresent ? 'ok' : 'bad'}
        />
        <Tile
          label="Admin API token"
          value={loading ? 'Checking…' : data?.requestTokenFound ? 'Detected' : 'Missing'}
          tone={data?.requestTokenFound ? 'ok' : 'bad'}
        />
        <Tile
          label="Route resolved admin"
          value={loading ? 'Checking…' : data?.getCurrentUserFromRequest?.role === 'admin' ? 'Yes' : 'No'}
          tone={data?.getCurrentUserFromRequest?.role === 'admin' ? 'ok' : 'bad'}
        />
      </div>

      {data ? (
        <>
          <div className="mt-4 space-y-1 text-xs font-mono text-[var(--color-muted)]">
            <div>Postgres host: {data.postgresHostFromEnv || '(missing)'}</div>
            <div>JWT subject: {data.requestJwtSubject_unverified || '(missing)'}</div>
            <div>JWT email: {data.requestJwtEmail_unverified || '(hidden or missing)'}</div>
            <div>Detail level: {data.detailLevel}</div>
          </div>

          {data.mismatch_notes.length > 0 ? (
            <div className="mt-4 rounded border border-[var(--color-red)]/30 bg-[var(--color-red)]/5 p-3">
              <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-red)] mb-2">
                What looks off
              </div>
              <ul className="space-y-1 text-sm">
                {data.mismatch_notes.map((note) => (
                  <li key={note}>{note}</li>
                ))}
              </ul>
            </div>
          ) : null}

          <details className="mt-4">
            <summary className="cursor-pointer font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
              Raw diagnostics
            </summary>
            <pre className="mt-3 overflow-x-auto rounded bg-[var(--color-bg)] p-3 text-xs">
              {JSON.stringify(data, null, 2)}
            </pre>
          </details>
        </>
      ) : null}

      {error ? <div className="mt-4 text-sm text-[var(--color-red)]">{error}</div> : null}
    </section>
  );
}

function Tile({
  label,
  value,
  tone = 'neutral',
}: {
  label: string;
  value: string;
  tone?: 'neutral' | 'ok' | 'bad';
}) {
  const color =
    tone === 'ok'
      ? 'text-green-700'
      : tone === 'bad'
        ? 'text-[var(--color-red)]'
        : 'text-[var(--color-ink)]';

  return (
    <div className="rounded border border-[var(--color-line)] p-3">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-1">
        {label}
      </div>
      <div className={`text-sm font-semibold ${color}`}>{value}</div>
    </div>
  );
}
