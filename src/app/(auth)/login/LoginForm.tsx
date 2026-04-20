'use client';

import { useState, useTransition } from 'react';

type Action = (formData: FormData) => Promise<{ error?: string }>;

export default function LoginForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Phone (or email)</label>
        <input name="identifier" type="text" required autoComplete="username" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Password</label>
        <input name="password" type="password" required autoComplete="current-password" />
      </div>
      {error && <div className="text-sm text-[var(--color-red)]">{error}</div>}
      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
        {isPending ? 'Signing in...' : 'Sign in'}
      </button>
    </form>
  );
}
