import { getPlanningWeekMode, listClaimsForOfferings, listOfferings } from '@/lib/db';
import { getPlanningWeekStart, weekDates } from '@/lib/week';
import OfferingForm from './OfferingForm';
import OfferingList from './OfferingList';
import PlanningWeekToggle from './PlanningWeekToggle';

export default async function AdminOfferingsPage() {
  const planningMode = await getPlanningWeekMode();
  const weekStartDate = getPlanningWeekStart(planningMode);
  const weekStart = weekStartDate.toISOString().slice(0, 10);
  const offerings = await listOfferings(weekStart);
  const claimCountByOffering = new Map<string, number>();
  const claims = await listClaimsForOfferings(offerings.map((o) => o.id));
  for (const c of claims) {
    claimCountByOffering.set(c.offering_id, (claimCountByOffering.get(c.offering_id) || 0) + 1);
  }

  const week = weekDates(weekStartDate);

  return (
    <div>
      <PlanningWeekToggle mode={planningMode} />
      <div className="mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
          Week of {new Date(weekStart + 'T00:00:00').toLocaleDateString(undefined, { month: 'long', day: 'numeric' })}
        </div>
        <h1 className="font-display text-5xl leading-none">Post shifts</h1>
        <p className="text-[var(--color-muted)] mt-3 max-w-xl">
          Add shifts as partners request coverage. Drivers see them immediately and can claim availability up to Friday 23:59.
        </p>
      </div>

      <div className="grid md:grid-cols-[1fr_1.5fr] gap-8">
        <div className="hairline rounded bg-white p-5">
          <h2 className="font-display text-2xl mb-3">New shift</h2>
          <OfferingForm weekDates={week} />
        </div>

        <OfferingList
          offerings={offerings.map((o) => ({
            id: o.id,
            date: o.date,
            start_time: o.start_time,
            end_time: o.end_time,
            label: o.label,
            notes: o.notes,
            claimCount: claimCountByOffering.get(o.id) || 0,
          }))}
        />
      </div>
    </div>
  );
}
