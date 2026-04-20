import Link from 'next/link';
import { redirect } from 'next/navigation';
import { getCurrentUser } from '@/lib/auth';

export default async function Home() {
  const user = await getCurrentUser();
  if (user) {
    redirect(user.role === 'admin' ? '/admin' : '/driver');
  }

  return (
    <main className="min-h-screen grain">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <div className="flex items-baseline justify-between mb-16">
          <span className="font-mono text-xs uppercase tracking-widest">driver_ops / v0.1</span>
          <span className="font-mono text-xs uppercase tracking-widest">mvp · internal</span>
        </div>

        <h1 className="font-display text-6xl md:text-8xl leading-[0.95] mb-8">
          Shifts, approvals,
          <br />
          <em>and the daily walkaround.</em>
        </h1>

        <p className="max-w-xl text-lg mb-12 text-[var(--color-muted)]">
          A small internal tool. Drivers submit next-week availability by Friday, we approve
          or deny, and they log a five-photo vehicle &amp; uniform inspection each day they drive.
        </p>

        <div className="flex gap-3 mb-24">
          <Link href="/signup" className="btn btn-primary">
            Create account
          </Link>
          <Link href="/login" className="btn btn-ghost">
            Sign in
          </Link>
        </div>

        <div className="grid md:grid-cols-3 gap-6">
          <Feature n="01" title="Availability">
            Three shifts per day, Mon–Sun. Lock-in at Friday 23:59.
          </Feature>
          <Feature n="02" title="Approvals">
            Dispatcher reviews and marks each shift approved or denied with a reason.
          </Feature>
          <Feature n="03" title="Inspection log">
            Five photos each driving day. Timestamped, retained on the service.
          </Feature>
        </div>
      </div>
    </main>
  );
}

function Feature({ n, title, children }: { n: string; title: string; children: React.ReactNode }) {
  return (
    <div className="hairline rounded p-5 bg-white">
      <div className="font-mono text-xs text-[var(--color-muted)] mb-3">{n}</div>
      <div className="font-display text-2xl mb-2">{title}</div>
      <p className="text-sm text-[var(--color-muted)]">{children}</p>
    </div>
  );
}
