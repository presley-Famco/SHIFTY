import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { deleteUserById, findUserById, listUsers } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const actor = await getCurrentUserFromRequest(req);
    if (!actor || actor.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized. Please log out and sign in again as admin.' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as { targetUserId?: string };
    const targetUserId = String(body.targetUserId || '').trim();
    if (!targetUserId) {
      return NextResponse.json({ error: 'Missing target user.' }, { status: 400 });
    }

    const target = await findUserById(targetUserId);
    if (!target || target.role !== 'admin') {
      return NextResponse.json({ error: 'That admin was not found.' }, { status: 404 });
    }

    const users = await listUsers();
    const adminCount = users.filter((u) => u.role === 'admin').length;
    if (adminCount <= 1) {
      return NextResponse.json(
        { error: 'Cannot remove the last admin. Add another admin first.' },
        { status: 400 },
      );
    }

    await deleteUserById(targetUserId);

    revalidatePath('/admin/drivers');
    revalidatePath('/admin');

    const deletedSelf = targetUserId === actor.id;
    return NextResponse.json({ ok: true, deletedSelf });
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to remove admin.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
