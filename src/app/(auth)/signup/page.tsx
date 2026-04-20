import Link from 'next/link';
import { signupAction } from '../actions';
import SignupForm from './SignupForm';

export default function SignupPage() {
  return (
    <main className="min-h-screen grain flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link href="/" className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-ink)]">
          ← SHIFTY
        </Link>
        <h1 className="font-display text-5xl mt-4 mb-2">Create account</h1>
        <p className="text-[var(--color-muted)] mb-8">
          Drivers and admins both sign up here. Driver signup may be restricted to approved emails.
        </p>
        <SignupForm action={signupAction} />
        <p className="text-sm mt-6 text-[var(--color-muted)]">
          Already have an account?{' '}
          <Link href="/login" className="underline text-[var(--color-ink)]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
