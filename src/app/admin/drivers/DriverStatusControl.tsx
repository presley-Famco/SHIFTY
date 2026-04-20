'use client';

import { useEffect, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { DriverStatus } from '@/lib/db';

type Props = {
  userId: string;
  currentStatus: DriverStatus;
};

const OPTIONS: { value: DriverStatus; label: string }[] = [
  { value: 'active_compliant', label: 'Active / compliant' },
  { value: 'pending', label: 'Pending' },
  { value: 'removed_archived', label: 'Removed / archived' },
];

export default function DriverStatusControl({ userId, currentStatus }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [value, setValue] = useState<DriverStatus>(currentStatus);
  const [error, setError] = useState<string>('');

  useEffect(() => {
    setValue(currentStatus);
  }, [currentStatus]);

  return (
    <div className="flex items-center gap-2">
      <select
        className="text-xs font-mono uppercase tracking-wider"
        value={value}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            const next = e.target.value as DriverStatus;
            setValue(next);
            setError('');
            const res = await fetch('/api/admin/driver-status', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              credentials: 'include',
              body: JSON.stringify({ userId, status: next }),
            });
            const data = (await res.json()) as { ok?: boolean; error?: string };
            if (!res.ok || data.error) {
              setError(data.error || 'Could not update driver.');
              setValue(currentStatus);
              return;
            }
            router.refresh();
          })
        }
      >
        {OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>
            {o.label}
          </option>
        ))}
      </select>
      {isPending ? <span className="text-xs text-[var(--color-muted)]">Saving...</span> : null}
      {error ? <span className="text-xs text-red-600">{error}</span> : null}
    </div>
  );
}
