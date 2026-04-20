import Link from 'next/link';
import type { User } from '@/lib/db';

export default function TopNav({ user }: { user: User }) {
  const isAdmin = user.role === 'admin';
  return (
    <nav className="hairline border-t-0 border-x-0 bg-white">
      <div className="max-w-6xl mx-auto px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <Link href={isAdmin ? '/admin' : '/driver'} className="font-mono text-xs uppercase tracking-widest">
            SHIFTY
          </Link>
          {isAdmin ? (
            <div className="flex gap-4 text-sm">
              <Link href="/admin" className="hover:underline">Claims</Link>
              <Link href="/admin/offerings" className="hover:underline">Shifts</Link>
              <Link href="/admin/inspections" className="hover:underline">Inspections</Link>
              <Link href="/admin/drivers" className="hover:underline">Drivers</Link>
            </div>
          ) : (
            <div className="flex gap-4 text-sm">
              <Link href="/driver" className="hover:underline">Shifts</Link>
              <Link href="/driver/inspection" className="hover:underline">Daily inspection</Link>
              <Link href="/driver/history" className="hover:underline">History</Link>
            </div>
          )}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-xs text-[var(--color-muted)]">
            {user.name} <span className="font-mono uppercase">· {user.role}</span>
          </span>
          <Link href="/logout" className="text-xs underline hover:text-[var(--color-accent)]">
            logout
          </Link>
        </div>
      </div>
    </nav>
  );
}
