'use client';

import { useTransition } from 'react';
import { claimShiftAction, unclaimShiftAction } from './actions';

type Props = {
  offering: {
    id: string;
    label: string;
    notes: string | null;
    startLabel: string;
    endLabel: string;
  };
  claimId?: string;
  status?: 'pending' | 'approved' | 'denied';
  reason: string | null;
  locked: boolean;
};

export default function ShiftRow({ offering, status, reason, locked }: Props) {
  const [isPending, startTransition] = useTransition();
  const claimed = !!status;
  const dispatchPhone = process.env.NEXT_PUBLIC_DISPATCH_PHONE || '';
  const dispatchDigits = dispatchPhone.replace(/[^\d+]/g, '');
  const dispatchHref = dispatchDigits ? `tel:${dispatchDigits}` : '';

  return (
    <div className="hairline rounded bg-white p-4 flex flex-wrap items-center gap-4 justify-between">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-3 flex-wrap">
          <span className="font-mono text-sm font-semibold">
            {offering.startLabel} – {offering.endLabel}
          </span>
          <span className="font-display text-lg">{offering.label}</span>
          {status === 'approved' && <span className="pill pill-approved">Approved</span>}
          {status === 'denied' && <span className="pill pill-denied">Denied</span>}
          {status === 'pending' && <span className="pill pill-pending">Pending</span>}
        </div>
        {offering.notes && (
          <div className="text-sm text-[var(--color-muted)] mt-1">{offering.notes}</div>
        )}
        {status === 'denied' && reason && (
          <div className="text-sm mt-2 text-[var(--color-red)]">
            <span className="font-mono uppercase text-xs mr-1">reason:</span>
            {reason}
          </div>
        )}
        {status === 'approved' && (
          <div className="text-sm mt-2 text-[var(--color-muted)]">
            Can no longer work this shift? Call dispatch right away so partner coverage can be
            updated.
          </div>
        )}
      </div>

      <div>
        {claimed ? (
          status === 'approved' ? (
            dispatchHref ? (
              <a className="btn btn-ghost" href={dispatchHref}>
                Call dispatch
              </a>
            ) : (
              <button className="btn btn-ghost" disabled title="Set NEXT_PUBLIC_DISPATCH_PHONE">
                Call dispatch
              </button>
            )
          ) : (
            <button
              className="btn btn-ghost"
              disabled={isPending || locked || status !== 'pending'}
              onClick={() =>
                startTransition(async () => {
                  await unclaimShiftAction(offering.id);
                })
              }
              title={
                status !== 'pending'
                  ? 'Already decided — contact dispatch to change.'
                  : 'Remove this claim'
              }
            >
              {status === 'pending' ? 'Remove' : 'Locked'}
            </button>
          )
        ) : (
          <button
            className="btn btn-primary"
            disabled={isPending || locked}
            onClick={() =>
              startTransition(async () => {
                await claimShiftAction(offering.id);
              })
            }
          >
            {isPending ? '...' : "I'm available"}
          </button>
        )}
      </div>
    </div>
  );
}
