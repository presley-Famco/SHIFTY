import { revalidatePath } from 'next/cache';
import { NextResponse } from 'next/server';
import { getCurrentUserFromRequest } from '@/lib/auth';
import { decideClaim, findClaimById, type ClaimStatus } from '@/lib/db';

export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    const user = await getCurrentUserFromRequest(req);
    if (!user || user.role !== 'admin') {
      return NextResponse.json(
        { error: 'Not authorized. Please log out and sign in again as admin.' },
        { status: 403 },
      );
    }

    const body = (await req.json()) as {
      claimId?: string;
      status?: ClaimStatus;
      reason?: string | null;
    };
    const claimId = String(body.claimId || '').trim();
    const status = body.status;
    const reason = body.reason === undefined || body.reason === null ? null : String(body.reason);

    if (!claimId || (status !== 'approved' && status !== 'denied')) {
      return NextResponse.json({ error: 'Invalid request.' }, { status: 400 });
    }

    const claim = await findClaimById(claimId);
    if (!claim) return NextResponse.json({ error: 'Claim not found.' }, { status: 404 });
    if (status === 'denied' && !reason?.trim()) {
      return NextResponse.json({ error: 'A reason is required when denying.' }, { status: 400 });
    }

    await decideClaim(claimId, status, reason);
    revalidatePath('/admin');
    return NextResponse.json({});
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Failed to update claim.';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
