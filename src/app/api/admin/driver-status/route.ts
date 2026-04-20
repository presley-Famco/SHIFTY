import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUser } from '@/lib/auth';
import { setDriverStatus, type DriverStatus } from '@/lib/db';

const STATUSES: DriverStatus[] = ['active_compliant', 'pending', 'removed_archived'];

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized. Please log out and sign in again as admin.' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { userId?: string; status?: string };
    const userId = String(body.userId || '').trim();
    const status = body.status as DriverStatus;
    if (!userId || !STATUSES.includes(status)) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    await setDriverStatus(userId, status);
    revalidatePath('/admin/drivers');
    revalidatePath('/admin');
    revalidatePath('/driver');
    return NextResponse.json({ ok: true });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update driver status.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
