'use client';

import { useState, useTransition } from 'react';

type Action = (formData: FormData) => Promise<{ error?: string; ok?: boolean; message?: string }>;

export default function ForgotPasswordForm({ action }: { action: Action }) {
  const [error, setError] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  return (
    <form
      method="post"
      onSubmit={(e) => {
        e.preventDefault();
        const fd = new FormData(e.currentTarget);
        setError(null);
        setSuccessMessage(null);
        startTransition(async () => {
          const res = await action(fd);
          if (res?.error) setError(res.error);
          if (res?.ok) {
            setSuccessMessage(res.message || 'Password reset successful. You can sign in now.');
            e.currentTarget.reset();
          }
        });
      }}
      className="space-y-3"
    >
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">Phone number</label>
        <input name="phone" type="tel" required autoComplete="tel" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">
          Reset code (from dispatch)
        </label>
        <input name="resetCode" type="password" required autoComplete="off" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">New password</label>
        <input name="password" type="password" required minLength={8} autoComplete="new-password" />
      </div>
      <div>
        <label className="block text-xs font-mono uppercase tracking-wider mb-1">
          Confirm new password
        </label>
        <input name="confirmPassword" type="password" required minLength={8} autoComplete="new-password" />
      </div>

      {error && <div className="text-sm text-[var(--color-red)]">{error}</div>}
      {successMessage && <div className="text-sm text-[var(--color-green)]">{successMessage}</div>}

      <button type="submit" className="btn btn-primary w-full" disabled={isPending}>
        {isPending ? 'Updating...' : 'Reset password'}
      </button>
    </form>
  );
}
