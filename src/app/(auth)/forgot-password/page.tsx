import Link from 'next/link';
import ForgotPasswordForm from './ForgotPasswordForm';
import { resetPasswordByPhoneAction } from '../actions';

export default function ForgotPasswordPage() {
  const resetEnabled = !!process.env.DRIVER_PASSWORD_RESET_CODE;
  return (
    <main className="min-h-screen grain flex items-center justify-center p-6">
      <div className="w-full max-w-md">
        <Link
          href="/login"
          className="font-mono text-xs uppercase tracking-widest text-[var(--color-muted)] hover:text-[var(--color-ink)]"
        >
          ← back to sign in
        </Link>
        <h1 className="font-display text-5xl mt-4 mb-2">Reset password</h1>
        <p className="text-[var(--color-muted)] mb-8">
          Use your phone number and a dispatch-issued reset code to set a new password.
        </p>
        {resetEnabled ? (
          <>
            <ForgotPasswordForm action={resetPasswordByPhoneAction} />
            <p className="text-sm mt-6 text-[var(--color-muted)]">
              After reset, go back to{' '}
              <Link href="/login" className="underline text-[var(--color-ink)]">
                Sign in
              </Link>
              .
            </p>
          </>
        ) : (
          <div className="hairline rounded bg-white p-4 text-sm text-[var(--color-muted)]">
            Password reset is disabled. Contact dispatch to reset your account securely.
          </div>
        )}
      </div>
    </main>
  );
}
