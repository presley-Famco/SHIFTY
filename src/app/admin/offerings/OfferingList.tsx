'use client';

import { useRouter } from 'next/navigation';
import { useTransition } from 'react';

function formatTime(hhmm: string): string {
  const [h, m] = hhmm.split(':').map(Number);
  const suffix = h >= 12 ? 'PM' : 'AM';
  const hour12 = ((h + 11) % 12) + 1;
  return `${hour12}:${m.toString().padStart(2, '0')} ${suffix}`;
}

type Offering = {
  id: string;
  date: string;
  start_time: string;
  end_time: string;
  label: string;
  notes: string | null;
  claimCount: number;
};

export default function OfferingList({ offerings }: { offerings: Offering[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const byDate = new Map<string, Offering[]>();
  for (const o of offerings) {
    if (!byDate.has(o.date)) byDate.set(o.date, []);
    byDate.get(o.date)!.push(o);
  }

  return (
    <div>
      <h2 className="font-display text-2xl mb-3">Posted shifts</h2>
      {offerings.length === 0 ? (
        <div className="hairline rounded bg-white p-6 text-center text-[var(--color-muted)]">
          None yet. Add your first shift on the left.
        </div>
      ) : (
        <div className="space-y-4">
          {[...byDate.entries()]
            .sort(([a], [b]) => a.localeCompare(b))
            .map(([date, list]) => (
              <div key={date}>
                <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] mb-1">
                  {new Date(date + 'T00:00:00').toLocaleDateString(undefined, {
                    weekday: 'long',
                    month: 'short',
                    day: 'numeric',
                  })}
                </div>
                <div className="space-y-2">
                  {list.map((o) => (
                    <div key={o.id} className="hairline rounded bg-white p-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-mono text-sm font-semibold">
                            {formatTime(o.start_time)} – {formatTime(o.end_time)}
                          </span>
                          <span className="font-display">{o.label}</span>
                          <span className="pill">
                            {o.claimCount} claim{o.claimCount === 1 ? '' : 's'}
                          </span>
                        </div>
                        {o.notes && (
                          <div className="text-xs text-[var(--color-muted)] mt-1">{o.notes}</div>
                        )}
                      </div>
                      <button
                        className="btn btn-ghost text-sm"
                        disabled={isPending}
                        onClick={() => {
                          if (!confirm(`Delete this shift? ${o.claimCount} claim${o.claimCount === 1 ? '' : 's'} will be removed.`)) return;
                          startTransition(async () => {
                            const res = await fetch(
                              `/api/admin/offerings?id=${encodeURIComponent(o.id)}`,
                              { method: 'DELETE', credentials: 'include' },
                            );
                            if (!res.ok) {
                              try {
                                const data = (await res.json()) as { error?: string };
                                alert(data.error || `Delete failed (${res.status})`);
                              } catch {
                                alert(`Delete failed (${res.status})`);
                              }
                              return;
                            }
                            router.refresh();
                          });
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            ))}
        </div>
      )}
    </div>
  );
}
