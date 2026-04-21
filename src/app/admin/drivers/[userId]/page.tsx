import Link from 'next/link';
import { notFound } from 'next/navigation';
import { unstable_noStore as noStore } from 'next/cache';
import {
  findOfferingById,
  findUserById,
  listClaimsForUser,
  listInspectionsForUser,
  listPhotosForInspection,
  type ShiftClaim,
  type ShiftOffering,
} from '@/lib/db';
import DriverStatusControl from '../DriverStatusControl';
import DriverDetailExport from './DriverDetailExport';

function formatDriverStatus(s: string | null): string {
  if (s === 'active_compliant') return 'Active / compliant';
  if (s === 'removed_archived') return 'Removed / archived';
  if (s === 'pending') return 'Pending';
  return 'Active / compliant';
}

export default async function AdminDriverDetailPage({
  params,
}: {
  params: Promise<{ userId: string }>;
}) {
  noStore();
  const { userId } = await params;
  const user = await findUserById(userId);
  if (!user || user.role !== 'driver') notFound();

  const claims = await listClaimsForUser(userId);
  const sortedShifts: { claim: ShiftClaim; offering: ShiftOffering }[] = [];
  for (const c of claims) {
    const o = await findOfferingById(c.offering_id);
    if (o) sortedShifts.push({ claim: c, offering: o });
  }
  sortedShifts.sort((a, b) =>
    (b.offering.date + b.offering.start_time).localeCompare(a.offering.date + a.offering.start_time),
  );

  const inspections = await listInspectionsForUser(userId);
  const inspectionsWithPhotos = await Promise.all(
    inspections.map(async (i) => ({
      inspection: i,
      photos: await listPhotosForInspection(i.id),
    })),
  );

  const shiftExportRows = sortedShifts.map(({ claim, offering: o }) => ({
    date: o.date,
    start_time: o.start_time,
    end_time: o.end_time,
    label: o.label,
    status: claim.status,
    decision_reason: claim.decision_reason ?? '',
    claimed_at: claim.created_at,
    decided_at: claim.decided_at ?? '',
  }));

  const inspectionExportRows = inspectionsWithPhotos.map(({ inspection: i, photos }) => ({
    date: i.date,
    submitted_at: i.created_at,
    photo_count: photos.length,
    labels: photos.map((p) => p.label).join('; '),
  }));

  const driverSlug = `${user.name.replace(/\s+/g, '-').toLowerCase()}_${user.id.slice(0, 8)}`;

  return (
    <div>
      <div className="mb-6">
        <Link
          href="/admin/drivers"
          className="text-sm font-mono uppercase tracking-wider text-[var(--color-muted)] hover:underline"
        >
          ← People
        </Link>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-6 mb-10">
        <div>
          <h1 className="font-display text-5xl leading-none mb-2">{user.name}</h1>
          <div className="text-sm font-mono text-[var(--color-muted)]">
            {user.email} · {user.phone}
          </div>
          <div className="text-sm font-mono text-[var(--color-muted)] mt-1">
            Status: {formatDriverStatus(user.driver_status)}
          </div>
          <div className="text-xs font-mono text-[var(--color-muted)] mt-2">
            Joined {new Date(user.created_at).toLocaleDateString()}
          </div>
        </div>
        <div className="flex flex-col items-start gap-4 shrink-0">
          <DriverStatusControl userId={user.id} currentStatus={user.driver_status ?? 'active_compliant'} />
          <DriverDetailExport
            driverSlug={driverSlug}
            shifts={shiftExportRows}
            inspections={inspectionExportRows}
          />
        </div>
      </div>

      <section className="mb-12">
        <h2 className="font-display text-2xl mb-4">Shift history</h2>
        {sortedShifts.length === 0 ? (
          <div className="hairline rounded bg-white p-8 text-[var(--color-muted)] text-sm">
            No claimed shifts yet.
          </div>
        ) : (
          <div className="hairline rounded bg-white overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-[var(--color-line)] text-left font-mono text-xs uppercase tracking-wider text-[var(--color-muted)]">
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Time</th>
                  <th className="px-4 py-3">Shift</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody>
                {sortedShifts.map(({ claim, offering: o }) => (
                  <tr key={claim.id} className="border-t border-[var(--color-line)]">
                    <td className="px-4 py-3 whitespace-nowrap">
                      {new Date(o.date + 'T12:00:00').toLocaleDateString(undefined, {
                        weekday: 'short',
                        month: 'short',
                        day: 'numeric',
                        year: 'numeric',
                      })}
                    </td>
                    <td className="px-4 py-3 font-mono text-xs whitespace-nowrap">
                      {o.start_time}–{o.end_time}
                    </td>
                    <td className="px-4 py-3">{o.label}</td>
                    <td className="px-4 py-3 capitalize">{claim.status}</td>
                    <td className="px-4 py-3 text-[var(--color-muted)] max-w-md">
                      {claim.decision_reason || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl mb-4">Inspections</h2>
        {inspectionsWithPhotos.length === 0 ? (
          <div className="hairline rounded bg-white p-8 text-[var(--color-muted)] text-sm">
            No inspections submitted yet.
          </div>
        ) : (
          <div className="space-y-6">
            {inspectionsWithPhotos.map(({ inspection: i, photos }) => (
              <div key={i.id} className="hairline rounded bg-white p-4">
                <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                  <div className="font-display text-2xl">
                    {new Date(i.date + 'T00:00:00').toLocaleDateString(undefined, {
                      weekday: 'long',
                      month: 'long',
                      day: 'numeric',
                    })}
                  </div>
                  <span className="text-xs font-mono text-[var(--color-muted)]">
                    submitted {new Date(i.created_at).toLocaleString()}
                  </span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {photos.map((p) => (
                    <a
                      key={p.id}
                      href={p.data_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="block aspect-square rounded overflow-hidden hairline relative group"
                    >
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={p.data_url} alt={p.label} className="w-full h-full object-cover" />
                      <div className="absolute bottom-0 left-0 right-0 bg-black/60 text-white text-[10px] font-mono uppercase px-1 py-0.5 opacity-0 group-hover:opacity-100 transition">
                        {p.label.replace('_', ' ')}
                      </div>
                    </a>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
