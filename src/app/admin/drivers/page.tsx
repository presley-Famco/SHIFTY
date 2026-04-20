import { listUsers } from '@/lib/db';
import { getCurrentUser } from '@/lib/auth';
import { unstable_noStore as noStore } from 'next/cache';
import DriverStatusControl from './DriverStatusControl';
import RemoveAdminButton from './RemoveAdminButton';

function formatDriverStatus(s: string | null): string {
  if (s === 'active_compliant') return 'Active / compliant';
  if (s === 'removed_archived') return 'Removed / archived';
  if (s === 'pending') return 'Pending';
  return 'Active / compliant';
}

export default async function AdminDriversPage() {
  noStore();
  const users = await listUsers();
  const sessionUser = await getCurrentUser();
  const drivers = users.filter((u) => u.role === 'driver');
  const admins = users.filter((u) => u.role === 'admin');
  const canRemoveAdmin = admins.length > 1;
  const activeDrivers = drivers.filter((u) => u.driver_status === 'active_compliant').length;
  const pendingDrivers = drivers.filter((u) => u.driver_status === 'pending').length;
  const archivedDrivers = drivers.filter((u) => u.driver_status === 'removed_archived').length;

  return (
    <div>
      <h1 className="font-display text-5xl leading-none mb-8">People</h1>
      <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
        <Stat label="Total users" value={users.length} />
        <Stat label="Drivers" value={drivers.length} />
        <Stat label="Active" value={activeDrivers} />
        <Stat label="Pending" value={pendingDrivers} />
        <Stat label="Archived" value={archivedDrivers} />
      </div>
      <section className="mb-10">
        <h2 className="font-display text-2xl mb-3">Drivers ({drivers.length})</h2>
        {drivers.length === 0 ? (
          <div className="hairline rounded bg-white p-6 text-[var(--color-muted)]">
            No drivers signed up yet.
          </div>
        ) : (
          <div className="hairline rounded bg-white overflow-hidden">
            {drivers.map((u, i) => (
              <div
                key={u.id}
                className={`px-4 py-3 flex items-center justify-between ${
                  i > 0 ? 'border-t border-[var(--color-line)]' : ''
                }`}
              >
                <div>
                  <div className="font-display text-lg">{u.name}</div>
                  <div className="text-xs font-mono text-[var(--color-muted)]">
                    {u.email} · {u.phone}
                  </div>
                  <div className="text-xs font-mono text-[var(--color-muted)] mt-1">
                    Status: {formatDriverStatus(u.driver_status)}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <DriverStatusControl userId={u.id} currentStatus={u.driver_status ?? 'active_compliant'} />
                  <div className="text-xs font-mono text-[var(--color-muted)]">
                    {new Date(u.created_at).toLocaleDateString()}
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>

      <section>
        <h2 className="font-display text-2xl mb-3">Admins ({admins.length})</h2>
        <div className="hairline rounded bg-white overflow-hidden">
          {admins.map((u, i) => (
            <div
              key={u.id}
              className={`px-4 py-3 flex items-center justify-between gap-4 ${
                i > 0 ? 'border-t border-[var(--color-line)]' : ''
              }`}
            >
              <div>
                <div className="font-display text-lg">{u.name}</div>
                <div className="text-xs font-mono text-[var(--color-muted)]">{u.email}</div>
                {sessionUser?.id === u.id ? (
                  <div className="text-xs font-mono text-[var(--color-muted)] mt-1">You</div>
                ) : null}
              </div>
              <RemoveAdminButton
                targetUserId={u.id}
                displayName={u.name}
                disabled={!canRemoveAdmin}
              />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <div className="hairline rounded bg-white p-4">
      <div className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)]">
        {label}
      </div>
      <div className="font-display text-3xl mt-1">{value}</div>
    </div>
  );
}
