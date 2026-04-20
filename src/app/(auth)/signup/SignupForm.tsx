'use client';

import { useState, useTransition } from 'react';

type Action = (formData: FormData) => Promise<{ error?: string }>;

export default function SignupForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [showAdmin, setShowAdmin] = useState(false);

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res?.error) setError(res.error);
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Full name</label>
        <input name="name" type="text" required autoComplete="name" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Email</label>
        <input name="email" type="email" required autoComplete="email" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Phone</label>
        <input name="phone" type="tel" required autoComplete="tel" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Password</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>

      <button
        type="button"
        onClick={() => setShowAdmin((s) => !s)}
        className="text-xs font-mono uppercase tracking-wider text-[var(--color-muted)] hover:text-[var(--color-ink)]"
      >
        {showAdmin ? '− hide' : '+ have an admin code?'}
      </button>
      {showAdmin && (
        <div>
          <label className="block text-xs font-mono uppercase tracking-wider mb-1">Admin code</label>
          <input name="adminCode" type="text" autoComplete="off" />
        </div>
      )}

      {error && <div className="text-sm text-[var(--color-red)]">{error}</div>}
      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
        {isPending ? 'Creating...' : 'Create account'}
      </button>
    </form>
  );
}
