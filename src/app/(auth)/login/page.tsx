import Link from 'next/link';
import { loginAction } from '../actions';
import LoginForm from './LoginForm';

export default function LoginPage() {
  const resetEnabled = !!process.env.DRIVER_PASSWORD_RESET_CODE;
  return (
    <main className="min-h-screen grain flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← SHIFTY
        </Link>
        <h1 className="font-display text-5xl mt-4 mb-2">Sign in</h1>
        <p className="text-[var(--color-muted)] mb-8">Welcome back.</p>
        <LoginForm action={loginAction} />
        <p className="text-sm mt-6 text-[var(--color-muted)]">
          New here?{' '}
          <Link href="/signup" className="underline text-[var(--color-ink)]">
            Create an account
          </Link>
        </p>
        {resetEnabled && (
          <p className="text-sm mt-3 text-[var(--color-muted)]">
            Forgot password?{' '}
            <Link href="/forgot-password" className="underline text-[var(--color-ink)]">
              Reset with phone number
            </Link>
          </p>
        )}
      </div>
    </main>
  );
}
