'use client';

import { useTransition } from 'react';
import { setDriverStatusAction } from '../actions';
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
  const [isPending, startTransition] = useTransition();

  return (
    <div className="flex items-center gap-2">
      <select
        className="text-xs font-mono uppercase tracking-wider"
        value={currentStatus}
        disabled={isPending}
        onChange={(e) =>
          startTransition(async () => {
            await setDriverStatusAction(userId, e.target.value as DriverStatus);
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
    </div>
  );
}
