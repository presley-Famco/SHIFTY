import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { createOffering, deleteOffering } from '@/lib/db';
import { getMondayOf } from '@/lib/week';

export const runtime = 'nodejs';

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized. Please log out and sign in again as admin.' },
        { status: 403 },
      );
    }

    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: 'Invalid JSON.' }, { status: 400 });
    }

    const date = String(body.date || '');
    const start_time = String(body.start_time || '');
    const end_time = String(body.end_time || '');
    const label = String(body.label || '').trim();
    const notesRaw = String(body.notes || '').trim();
    const notes = notesRaw ? notesRaw : null;

    if (!date || !start_time || !end_time || !label) {
      return NextResponse.json({ error: 'Date, start, end, and label are required.' }, { status: 400 });
    }
    if (start_time >= end_time) {
      return NextResponse.json({ error: 'Start time must be before end time.' }, { status: 400 });
    }

    const weekStart = getMondayOf(new Date(date + 'T00:00:00')).toISOString().slice(0, 10);

    await createOffering({
      id: randomId(),
      date,
      start_time,
      end_time,
      label,
      notes,
      week_start: weekStart,
      created_at: new Date().toISOString(),
      created_by: user.id,
    });
    revalidatePath('/admin/offerings');
    revalidatePath('/admin');
    return NextResponse.json({});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to create offering.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized. Please log out and sign in again as admin.' },
        { status: 403 },
      );
    }
    const id = new URL(req.url).searchParams.get('id')?.trim();
    if (!id) {
      return NextResponse.json({ error: 'Missing id.' }, { status: 400 });
    }
    await deleteOffering(id);
    revalidatePath('/admin/offerings');
    revalidatePath('/admin');
    return NextResponse.json({});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to delete offering.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
