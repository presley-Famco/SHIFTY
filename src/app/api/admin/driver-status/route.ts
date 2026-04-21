import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest, getRequestAuthDebug } from '@/lib/auth';
import { setDriverStatus, type DriverStatus } from '@/lib/db';

export const runtime = 'nodejs';

const STATUSES: DriverStatus[] = ['active_compliant', 'pending', 'removed_archived'];

function parseStatus(raw: unknown): DriverStatus | null {
  if (typeof raw !== 'string') return null;
  return STATUSES.includes(raw as DriverStatus) ? (raw as DriverStatus) : null;
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      const authDebug = await getRequestAuthDebug(req);
      return NextResponse.json(
        {
          error: 'Not authorized. Please log out and sign in again as admin.',
          authDebug,
        },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { userId?: string; status?: unknown };
    const userId = String(body.userId || '').trim();
    const status = parseStatus(body.status);
    if (!userId || !status) {
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
