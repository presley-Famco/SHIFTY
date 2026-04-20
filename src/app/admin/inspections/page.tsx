import { listAllInspections, listPhotosForInspection, listUsers, type User } from '@/lib/db';

export default async function AdminInspectionsPage() {
  const [inspections, users] = await Promise.all([listAllInspections(), listUsers()]);
  const userById = new Map<string, User>(users.map((u) => [u.id, u]));

  return (
    <div>
      <h1 className="font-display text-5xl leading-none mb-8">Inspection log</h1>
      {inspections.length === 0 ? (
        <div className="hairline rounded bg-white p-12 text-center">
          <div className="font-display text-2xl mb-2">Nothing submitted yet.</div>
          <p className="text-[var(--color-muted)]">Driver inspections will appear here.</p>
        </div>
      ) : (
        <div className="space-y-6">
          {await Promise.all(
            inspections.map(async (i) => {
              const photos = await listPhotosForInspection(i.id);
              const u = userById.get(i.user_id);
              return (
                <div key={i.id} className="hairline rounded bg-white p-4">
                  <div className="flex items-baseline justify-between mb-3 flex-wrap gap-2">
                    <div>
                      <div className="font-display text-2xl">{u?.name || 'Unknown'}</div>
                      <div className="text-xs font-mono text-[var(--color-muted)]">
                        {u?.email} · {u?.phone}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="font-mono text-sm">
                        {new Date(i.date + 'T00:00:00').toLocaleDateString(undefined, {
                          weekday: 'short',
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                      <div className="text-xs text-[var(--color-muted)]">
                        submitted {new Date(i.created_at).toLocaleTimeString()}
                      </div>
                    </div>
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {photos.map((p) => (
                      <a
                        key={p.id}
                        href={p.data_url}
                        target="_blank"
                        rel="noopener"
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
              );
            }),
          )}
        </div>
      )}
    </div>
  );
}
