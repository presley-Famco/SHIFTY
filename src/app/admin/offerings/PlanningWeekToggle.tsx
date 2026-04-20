'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import type { PlanningWeekMode } from '@/lib/db';

type Props = {
  mode: PlanningWeekMode;
};

export default function PlanningWeekToggle({ mode }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selected, setSelected] = useState<PlanningWeekMode>(mode);
  const [error, setError] = useState('');

  async function updateMode(next: PlanningWeekMode): Promise<void> {
    setSelected(next);
    setError('');
    const res = await fetch('/api/admin/planning-week-mode', {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ mode: next }),
    });
    let message = '';
    try {
      const data = (await res.json()) as { error?: string };
      message = data.error || '';
    } catch {
      message = res.statusText || `HTTP ${res.status}`;
    }
    if (!res.ok || message) {
      setSelected(mode);
      setError(message || `Could not update (${res.status}).`);
      return;
    }
    router.refresh();
  }

  return (
    <div className="hairline rounded bg-white p-4 mb-6">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
        Planning week mode
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className={`btn ${selected === 'next_week' ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateMode('next_week');
            })
          }
        >
          Default: next week
        </button>
        <button
          type="button"
          className={`btn ${selected === 'current_week' ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await updateMode('current_week');
            })
          }
        >
          Emergency: current week
        </button>
        {isPending ? <span className="text-xs text-[var(--color-muted)]">Saving...</span> : null}
        {error ? <span className="text-xs text-[var(--color-red)]">{error}</span> : null}
      </div>
    </div>
  );
}
