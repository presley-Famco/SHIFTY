'use client';

import { adminFetchInit } from '@/lib/admin-fetch';
import { useState } from 'react';
import { useRouter } from 'next/navigation';

type Props = {
  targetUserId: string;
  displayName: string;
  disabled: boolean;
};

export default function RemoveAdminButton({ targetUserId, displayName, disabled }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [error, setError] = useState('');

  return (
    <div className="flex flex-col items-end gap-1">
      <button
        type="button"
        title={
          disabled
            ? 'At least one admin must remain. Add another admin first, then you can remove someone.'
            : 'Remove this user’s admin access (account deleted)'
        }
        className="text-xs font-mono uppercase tracking-wider underline text-[var(--color-red)] hover:opacity-80 disabled:opacity-40 disabled:no-underline"
        disabled={disabled || pending}
        onClick={() => {
          if (
            !window.confirm(
              `Remove ${displayName} as an admin? Their user account will be deleted and they will not be able to sign in.`,
            )
          ) {
            return;
          }
          setPending(true);
          setError('');
          void (async () => {
            try {
              const res = await fetch(
                '/api/admin/remove-admin',
                adminFetchInit({
                  method: 'POST',
                  headers: { 'Content-Type': 'application/json' },
                  body: JSON.stringify({ targetUserId }),
                }),
              );
              let message = '';
              try {
                const data = (await res.json()) as { ok?: boolean; deletedSelf?: boolean; error?: string };
                if (res.ok && data.ok) {
                  if (data.deletedSelf) {
                    window.location.href = '/logout';
                    return;
                  }
                  router.refresh();
                  return;
                }
                message = data.error || '';
              } catch {
                message = res.statusText || `HTTP ${res.status}`;
              }
              setError(message || `Could not remove admin (HTTP ${res.status}).`);
            } finally {
              setPending(false);
            }
          })();
        }}
      >
        {pending ? 'Removing…' : 'Remove admin'}
      </button>
      {error ? <span className="text-xs text-red-600 max-w-[14rem] text-right">{error}</span> : null}
    </div>
  );
}
