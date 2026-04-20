'use client';

import { useTransition } from 'react';
import { setPlanningWeekModeAction } from '../actions';
import type { PlanningWeekMode } from '@/lib/db';

type Props = {
  mode: PlanningWeekMode;
};

export default function PlanningWeekToggle({ mode }: Props) {
  const [isPending, startTransition] = useTransition();

  return (
    <div className="hairline rounded bg-white p-4 mb-6">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
        Planning week mode
      </div>
      <div className="flex flex-wrap gap-2 items-center">
        <button
          type="button"
          className={`btn ${mode === 'next_week' ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setPlanningWeekModeAction('next_week');
            })
          }
        >
          Default: next week
        </button>
        <button
          type="button"
          className={`btn ${mode === 'current_week' ? 'btn-primary' : 'btn-ghost'}`}
          disabled={isPending}
          onClick={() =>
            startTransition(async () => {
              await setPlanningWeekModeAction('current_week');
            })
          }
        >
          Emergency: current week
        </button>
        {isPending ? <span className="text-xs text-[var(--color-muted)]">Saving...</span> : null}
      </div>
    </div>
  );
}
