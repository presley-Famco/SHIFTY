import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import {
  getInspectionByUserAndDate,
  listClaimsForUser,
  listOfferings,
  listPhotosForInspection,
  PHOTO_LABELS,
} from '@/lib/db';
import { minutesIntoDay, todayISO } from '@/lib/week';
import InspectionForm from './InspectionForm';
import InspectionCountdown from './InspectionCountdown';

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

export default async function InspectionPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const today = todayISO();
  const existing = await getInspectionByUserAndDate(user.id, today);
  const photos = existing ? await listPhotosForInspection(existing.id) : [];
  const nowMinutes = minutesIntoDay();

  const [claims, offerings] = await Promise.all([listClaimsForUser(user.id), listOfferings()]);
  const approvedOfferingIds = new Set(
    claims.filter((c) => c.status === 'approved').map((c) => c.offering_id),
  );
  const todaysApprovedOfferings = offerings
    .filter((o) => o.date === today && approvedOfferingIds.has(o.id))
    .sort((a, b) => (a.start_time + a.end_time).localeCompare(b.start_time + b.end_time));

  const canSubmitNow = todaysApprovedOfferings.some((o) => {
    const start = hhmmToMinutes(o.start_time);
    const end = hhmmToMinutes(o.end_time);
    return nowMinutes >= Math.max(0, start - 30) && nowMinutes <= end;
  });

  const upcoming = todaysApprovedOfferings.find((o) => nowMinutes < Math.max(0, hhmmToMinutes(o.start_time) - 30));
  const upcomingWindowOpensInSeconds = upcoming
    ? (Math.max(0, hhmmToMinutes(upcoming.start_time) - 30) - nowMinutes) * 60
    : null;
  const upcomingShiftLabel = upcoming
    ? `${new Date(`${today}T${upcoming.start_time}:00`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })} - ${new Date(`${today}T${upcoming.end_time}:00`).toLocaleTimeString([], {
        hour: 'numeric',
        minute: '2-digit',
      })}`
    : null;

  return (
    <div>
      <div className="mb-8">
        <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
          {new Date(today + 'T00:00:00').toLocaleDateString(undefined, {
            weekday: 'long',
            month: 'long',
            day: 'numeric',
          })}
        </div>
        <h1 className="font-display text-5xl leading-none mb-2">Daily inspection</h1>
        <p className="text-[var(--color-muted)] max-w-xl">
          Before your first ride of the day, submit five photos of your vehicle and uniform.
          These are timestamped and retained on the service.
        </p>
      </div>

      {existing ? (
        <div>
          <div className="hairline rounded bg-white p-6 mb-6">
            <div className="flex items-center gap-3 mb-2">
              <span className="pill pill-approved">Submitted</span>
              <span className="text-sm text-[var(--color-muted)]">
                {new Date(existing.created_at).toLocaleTimeString()}
              </span>
            </div>
            <p className="text-sm">You&rsquo;ve already submitted today&rsquo;s inspection. Come back tomorrow.</p>
          </div>

          <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
            {PHOTO_LABELS.map(({ key, title }) => {
              const p = photos.find((x) => x.label === key);
              return (
                <div key={key} className="hairline rounded bg-white overflow-hidden">
                  <div className="aspect-square bg-[var(--color-line)]">
                    {p ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={p.data_url} alt={title} className="w-full h-full object-cover" />
                    ) : null}
                  </div>
                  <div className="p-2 text-xs font-mono uppercase tracking-wider">{title}</div>
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <div>
          {!canSubmitNow && upcoming && upcomingWindowOpensInSeconds !== null && upcomingShiftLabel ? (
            <InspectionCountdown
              shiftLabel={upcomingShiftLabel}
              windowOpensInSeconds={upcomingWindowOpensInSeconds}
            />
          ) : null}
          {!canSubmitNow ? (
            <div className="hairline rounded bg-white p-6 mb-6">
              <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-2">
                Inspection locked
              </div>
              <p className="text-sm text-[var(--color-muted)]">
                You can submit only from 30 minutes before an approved shift until shift end.
              </p>
            </div>
          ) : (
            <InspectionForm />
          )}
        </div>
      )}
    </div>
  );
}
