'use client';

import { adminFetchInit } from '@/lib/admin-fetch';
import { useRouter } from 'next/navigation';
import { useState, useTransition } from 'react';

type Props = {
  claimId: string;
  driverName: string;
  driverEmail: string;
  driverPhone: string;
  date: string;
  timeRange: string;
  label: string;
  status: 'pending' | 'approved' | 'denied';
  reason: string | null;
};

export default function ClaimRow(props: Props) {
  const router = useRouter();
  const [showDeny, setShowDeny] = useState(false);
  const [reason, setReason] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const pretty = new Date(props.date + 'T00:00:00').toLocaleDateString(undefined, {
    weekday: 'short',
    month: 'short',
    day: 'numeric',
  });

  async function decide(status: 'approved' | 'denied', reason: string | null) {
    const res = await fetch(
      '/api/admin/claims/decide',
      adminFetchInit({
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          claimId: props.claimId,
          status,
          reason,
        }),
      }),
    );
    let message = '';
    try {
      const data = (await res.json()) as { error?: string };
      message = data.error || '';
    } catch {
      message = res.statusText || `HTTP ${res.status}`;
    }
    return { ok: res.ok && !message, error: message || (!res.ok ? `HTTP ${res.status}` : '') };
  }

  function approve() {
    setError(null);
    startTransition(async () => {
      const res = await decide('approved', null);
      if (res.error) setError(res.error);
      else router.refresh();
    });
  }

  function deny() {
    if (!reason.trim()) {
      setError('Enter a reason before denying.');
      return;
    }
    setError(null);
    startTransition(async () => {
      const res = await decide('denied', reason.trim());
      if (res.error) setError(res.error);
      else {
        setShowDeny(false);
        router.refresh();
      }
    });
  }

  return (
    <div className="hairline rounded bg-white p-4">
      <div className="flex flex-wrap items-start gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-baseline gap-3 flex-wrap">
            <span className="font-display text-xl">{props.driverName}</span>
            {props.status === 'approved' && <span className="pill pill-approved">Approved</span>}
            {props.status === 'denied' && <span className="pill pill-denied">Denied</span>}
            {props.status === 'pending' && <span className="pill pill-pending">Pending</span>}
          </div>
          <div className="text-sm text-[var(--color-muted)] mt-1">
            <span className="font-mono">{props.driverEmail}</span> · {props.driverPhone}
          </div>
          <div className="text-sm mt-2">
            <span className="font-mono font-semibold">{pretty}</span>
            <span className="mx-2">·</span>
            <span className="font-mono">{props.timeRange}</span>
            <span className="mx-2">·</span>
            <span>{props.label}</span>
          </div>
          {props.reason && props.status === 'denied' && (
            <div className="text-sm mt-2 text-[var(--color-red)]">
              <span className="font-mono uppercase text-xs mr-1">reason:</span>
              {props.reason}
            </div>
          )}
        </div>

        {props.status === 'pending' && (
          <div className="flex gap-2">
            <button className="btn btn-primary" onClick={approve} disabled={isPending}>
              Approve
            </button>
            <button className="btn btn-ghost" onClick={() => setShowDeny((s) => !s)} disabled={isPending}>
              Deny
            </button>
          </div>
        )}
      </div>

      {showDeny && (
        <div className="mt-4 pt-4 border-t border-[var(--color-line)]">
          <label className="block text-xs font-mono uppercase tracking-wider mb-1">
            Reason for denial (shown to driver)
          </label>
          <textarea
            rows={2}
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="e.g. conflict with approved ride-hail block, capacity reached, documents expired"
          />
          <div className="flex gap-2 mt-2">
            <button className="btn btn-primary" onClick={deny} disabled={isPending}>
              Confirm deny
            </button>
            <button className="btn btn-ghost" onClick={() => setShowDeny(false)}>
              Cancel
            </button>
          </div>
        </div>
      )}

      {error && <div className="text-[var(--color-red)] text-sm mt-2">{error}</div>}
    </div>
  );
}
