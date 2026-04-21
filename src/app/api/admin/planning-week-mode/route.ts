import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest, getRequestAuthDebug } from '@/lib/auth';
import { getPlanningWeekMode, setPlanningWeekMode, type PlanningWeekMode } from '@/lib/db';

export const runtime = 'nodejs';

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

    const body = (await req.json()) as { mode?: PlanningWeekMode };
    const mode = body.mode;
    if (mode !== 'next_week' && mode !== 'current_week') {
      return NextResponse.json({ error: 'Invalid mode.' }, { status: 400 });
    }

    const current = await getPlanningWeekMode();
    if (current !== mode) {
      await setPlanningWeekMode(mode);
    }
    revalidatePath('/admin');
    revalidatePath('/admin/offerings');
    revalidatePath('/driver');
    return NextResponse.json({});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update planning mode.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
