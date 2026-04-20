import Link from 'next/link';
import {
  getPlanningWeekMode,
  listAllClaims,
  listOfferings,
  listUsers,
  type ShiftClaim,
  type ShiftOffering,
  type User,
} from '@/lib/db';
import { getPlanningWeekStart } from '@/lib/week';
import ClaimRow from './ClaimRow';

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

export default async function AdminClaimsPage() {
  const planningMode = await getPlanningWeekMode();
  const nextWeek = getPlanningWeekStart(planningMode).toISOString().slice(0, 10);
  const [offerings, claims, users] = await Promise.all([
    listOfferings(nextWeek),
    listAllClaims(),
    listUsers(),
  ]);

  const userById = new Map<string, User>(users.map((u) => [u.id, u]));
  const offeringById = new Map<string, ShiftOffering>(offerings.map((o) => [o.id, o]));

  const weekClaims = claims.filter((c) => offeringById.has(c.offering_id));

  const pending = weekClaims.filter((c) => c.status === 'pending');
  const decided = weekClaims.filter((c) => c.status !== 'pending');

  return (
    <div>
      <div className="mb-8 flex items-end justify-between flex-wrap gap-4">
        <div>
          <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
            Week of {new Date(nextWeek + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
          </div>
          <h1 className="font-display text-5xl leading-none">Claims to review</h1>
        </div>
        <div className="flex gap-3">
          <Link href="/admin/offerings" className="btn btn-ghost">Manage shifts</Link>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4 mb-8">
        <Stat label="Pending" value={pending.length} />
        <Stat label="Approved" value={weekClaims.filter((c) => c.status === 'approved').length} />
        <Stat label="Denied" value={weekClaims.filter((c) => c.status === 'denied').length} />
      </div>

      <section className="mb-10">
        <h2 className="font-display text-3xl mb-4">Pending</h2>
        {pending.length === 0 ? (
          <div className="hairline rounded bg-white p-8 text-center text-[var(--color-muted)]">
            All caught up.
          </div>
        ) : (
          <div className="space-y-2">
            {pending.map((c) =>
              renderRow(c, offeringById.get(c.offering_id)!, userById.get(c.user_id)!),
            )}
          </div>
        )}
      </section>

      {decided.length > 0 && (
        <section>
          <h2 className="font-display text-3xl mb-4">Decided</h2>
          <div className="space-y-2">
            {decided.map((c) =>
              renderRow(c, offeringById.get(c.offering_id)!, userById.get(c.user_id)!),
            )}
          </div>
        </section>
      )}
    </div>
  );

  function renderRow(c: ShiftClaim, o: ShiftOffering | undefined, u: User | undefined) {
    if (!o || !u) return null;
    return (
      <ClaimRow
        key={c.id}
        claimId={c.id}
        driverName={u.name}
        driverEmail={u.email}
        driverPhone={u.phone}
        date={o.date}
        timeRange={`${formatTime(o.start_time)} – ${formatTime(o.end_time)}`}
        label={o.label}
        status={c.status}
        reason={c.decision_reason}
      />
    );
  }
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hairline rounded bg-white p-5">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </div>
      <div className="font-display text-4xl mt-1">{value}</div>
    </div>
  );
}
