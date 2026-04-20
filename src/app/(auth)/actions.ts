'use server';

import { redirect } from 'next/navigation';
import bcrypt from 'bcryptjs';
import {
  createUser,
  findUserByEmail,
  findUserByPhone,
  normalizePhone,
  updateUserPassword,
} from '@/lib/db';
import { createSession } from '@/lib/auth';

function randomId(): string {
  return (
    Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
  );
}

export async function signupAction(formData: FormData): Promise<{ error?: string }> {
  const email = String(formData.get('email') || '').trim().toLowerCase();
  const name = String(formData.get('name') || '').trim();
  const phone = String(formData.get('phone') || '').trim();
  const password = String(formData.get('password') || '');
  const adminCode = String(formData.get('adminCode') || '');

  if (!email || !name || !phone || !password) {
    return { error: 'All fields are required.' };
  }
  if (password.length < 8) {
    return { error: 'Password must be at least 8 characters.' };
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { error: 'Enter a valid email address.' };
  }

  const existing = await findUserByEmail(email);
  if (existing) return { error: 'An account with that email already exists.' };

  const role: 'admin' | 'driver' =
    adminCode && adminCode === (process.env.ADMIN_CODE || 'letmein') ? 'admin' : 'driver';

  if (role === 'driver') {
    const allowlistRaw = process.env.APPROVED_DRIVER_EMAILS || '';
    const allowlist = new Set(
      allowlistRaw
        .split(',')
        .map((x) => x.trim().toLowerCase())
        .filter(Boolean),
    );
    if (allowlist.size > 0 && !allowlist.has(email)) {
      return {
        error:
          'Signup is restricted to pre-approved drivers. Contact dispatch if you need access.',
      };
    }
  }

  const hash = await bcrypt.hash(password, 10);
  const id = randomId();
  await createUser({
    id,
    email,
    name,
    phone,
    password_hash: hash,
    role,
    driver_status: role === 'driver' ? 'pending' : null,
    created_at: new Date().toISOString(),
  });

  if (role === 'driver') {
    return {
      error:
        'Account created. Your driver profile is pending approval by dispatch before you can sign in.',
    };
  }

  await createSession(id);
  redirect(role === 'admin' ? '/admin' : '/driver');
}

export async function loginAction(formData: FormData): Promise<{ error?: string }> {
  const identifier = String(formData.get('identifier') || '').trim();
  const password = String(formData.get('password') || '');
  if (!identifier || !password) return { error: 'Phone/email and password are required.' };

  const asEmail = identifier.toLowerCase();
  const user =
    (asEmail.includes('@') ? await findUserByEmail(asEmail) : await findUserByPhone(identifier)) ??
    (await findUserByEmail(asEmail));
  if (!user) return { error: 'Invalid phone/email or password.' };
  if (user.role === 'driver' && user.driver_status && user.driver_status !== 'active_compliant') {
    if (user.driver_status === 'pending') {
      return { error: 'Your account is pending dispatch approval.' };
    }
    return { error: 'Your account has been archived. Contact dispatch.' };
  }
  const ok = await bcrypt.compare(password, user.password_hash);
  if (!ok) return { error: 'Invalid phone/email or password.' };

  await createSession(user.id);
  redirect(user.role === 'admin' ? '/admin' : '/driver');
}

export async function resetPasswordByPhoneAction(
  formData: FormData,
): Promise<{ error?: string; ok?: boolean; message?: string }> {
  const phone = String(formData.get('phone') || '').trim();
  const resetCode = String(formData.get('resetCode') || '').trim();
  const password = String(formData.get('password') || '');
  const confirm = String(formData.get('confirmPassword') || '');
  const expectedCode = String(process.env.DRIVER_PASSWORD_RESET_CODE || '').trim();

  if (!phone || !resetCode || !password || !confirm) return { error: 'All fields are required.' };
  if (!normalizePhone(phone)) return { error: 'Enter a valid US phone number.' };
  if (!expectedCode) {
    return { error: 'Password reset is not configured. Contact dispatch.' };
  }
  if (resetCode !== expectedCode) {
    return { error: 'Invalid reset code. Contact dispatch for a valid code.' };
  }
  if (password.length < 8) return { error: 'Password must be at least 8 characters.' };
  if (password !== confirm) return { error: 'Passwords do not match.' };

  const user = await findUserByPhone(phone);
  if (!user) return { error: 'No account found for that phone number.' };
  if (user.role === 'driver' && user.driver_status === 'removed_archived') {
    return { error: 'Account is archived. Contact dispatch.' };
  }

  const hash = await bcrypt.hash(password, 10);
  await updateUserPassword(user.id, hash);
  return { ok: true, message: 'Password reset successful. Return to sign in with your new password.' };
}
