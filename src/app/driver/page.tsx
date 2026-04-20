import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getPlanningWeekMode,
  listClaimsForUser,
  listOfferings,
  type ClaimStatus,
  type ShiftOffering,
} from '@/lib/db';
import { cutoffDescription, getPlanningWeekStart, isSubmissionOpen } from '@/lib/week';
import ShiftRow from './ShiftRow';

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

function formatDate(iso: string): { dow: string; md: string } {
  const d = new Date(iso + 'T00:00:00');
  const dow = d.toLocaleDateString(undefined, { weekday: 'short' });
  const md = d.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return { dow, md };
}

export default async function DriverShiftsPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const planningMode = await getPlanningWeekMode();
  const weekStartDate = getPlanningWeekStart(planningMode);
  const weekStart = weekStartDate.toISOString().slice(0, 10);

  const [offerings, claims] = await Promise.all([
    listOfferings(weekStart),
    listClaimsForUser(user.id),
  ]);

  const claimByOffering = new Map(claims.map((c) => [c.offering_id, c]));
  const open = isSubmissionOpen();

  // Group offerings by date
  const byDate = new Map<string, ShiftOffering[]>();
  for (const o of offerings) {
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date)!.push(o);
  }

  const claimedCount = offerings.filter((o) => claimByOffering.has(o.id)).length;

  return (
    <div>
      <div className="flex items-end justify-between flex-wrap gap-4 mb-8">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
            Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </div>
          <h1 className="font-display text-5xl leading-none">
            Available shifts
          </h1>
        </div>
        <div className="text-right">
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
            {open ? 'Submissions close' : 'Submissions closed'}
          </div>
          <div className="font-display text-xl">
            {open ? cutoffDescription() : 'See you Monday'}
          </div>
        </div>
      </div>

      <div className="hairline rounded bg-white p-4 mb-6 flex items-center justify-between">
        <div className="text-sm">
          <span className="font-mono font-semibold">{claimedCount}</span> shift
          {claimedCount === 1 ? '' : 's'} claimed for next week
          {claims.filter((c) => c.status === 'approved').length > 0 && (
            <span className="ml-2 text-[var(--color-muted)]">
              ({claims.filter((c) => c.status === 'approved').length} approved)
            </span>
          )}
        </div>
        {!open && (
          <div className="pill pill-denied">Locked</div>
        )}
      </div>

      {offerings.length === 0 ? (
        <div className="hairline rounded bg-white p-12 text-center">
          <div className="font-display text-3xl mb-2">Nothing posted yet.</div>
          <p className="text-[var(--color-muted)]">
            Check back — shifts for next week will appear here as partners request coverage.
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {[...byDate.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, list]) => {
              const { dow, md } = formatDate(date);
              return (
                <section key={date}>
                  <div className="flex items-baseline gap-3 mb-3">
                    <h2 className="font-display text-3xl">{dow}</h2>
                    <span className="text-[var(--color-muted)] font-mono text-sm">{md}</span>
                  </div>
                  <div className="space-y-2">
                    {list.map((o) => {
                      const claim = claimByOffering.get(o.id);
                      return (
                        <ShiftRow
                          key={o.id}
                          offering={{
                            ...o,
                            startLabel: formatTime(o.start_time),
                            endLabel: formatTime(o.end_time),
                          }}
                          claimId={claim?.id}
                          status={claim?.status as ClaimStatus | undefined}
                          reason={claim?.decision_reason ?? null}
                          locked={!open}
                        />
                      );
                    })}
                  </div>
                </section>
              );
            })}
        </div>
      )}
    </div>
  );
}
