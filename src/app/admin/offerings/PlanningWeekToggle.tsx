'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { setPlanningWeekModeAction } from '../actions';
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
    const result = await setPlanningWeekModeAction(next);
    if (result?.error) {
      setSelected(mode);
      setError(result.error);
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
