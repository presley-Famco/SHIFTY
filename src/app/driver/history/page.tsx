import { getCurrentUser } from '@/lib/auth';
import { redirect } from 'next/navigation';
import { listInspectionsForUser, listPhotosForInspection } from '@/lib/db';

export default async function DriverHistoryPage() {
  const user = await getCurrentUser();
  if (!user) redirect('/login');
  const inspections = await listInspectionsForUser(user.id);

  return (
    <div>
      <h1 className="font-display text-5xl leading-none mb-8">Inspection history</h1>
      {inspections.length === 0 ? (
        <div className="hairline rounded bg-white p-12 text-center">
          <div className="font-display text-2xl mb-2">No inspections yet.</div>
          <p className="text-[var(--color-muted)]">Your submitted daily inspections will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            inspections.map(async (i) => {
              const photos = await listPhotosForInspection(i.id);
              return (
                <div key={i.id} className="hairline rounded bg-white p-4">
                  <div className="flex items-baseline justify-between mb-3">
                    <div className="font-display text-2xl">
                      {new Date(i.date + 'T00:00:00').toLocaleDateString(undefined, {
                        weekday: 'long',
                        month: 'long',
                        day: 'numeric',
                      })}
                    </div>
                    <span className="text-xs font-mono text-[var(--color-muted)]">
                      {new Date(i.created_at).toLocaleTimeString()}
                    </span>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((p) => (
                      <div key={p.id} className="aspect-square rounded overflow-hidden hairline">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={p.data_url} alt={p.label} className="w-full h-full object-cover" />
                      </div>
                    ))}
                  </div>
                </div>
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
