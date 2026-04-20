'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import {
  createInspection,
  createOrUpdateClaim,
  deleteClaim,
  findOfferingById,
  getInspectionByUserAndDate,
  listClaimsForUser,
  listOfferings,
  PHOTO_LABELS,
  type PhotoLabel,
} from '@/lib/db';
import { isSubmissionOpen, minutesIntoDay, OPERATIONS_TIMEZONE, todayISO } from '@/lib/week';

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

function hhmmToMinutes(v: string): number {
  const [h, m] = v.split(':').map(Number);
  return h * 60 + m;
}

export async function claimShiftAction(offeringId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'driver') return { error: 'Not authorized.' };
  if (!isSubmissionOpen()) return { error: 'Submissions are closed until next week.' };

  const offering = await findOfferingById(offeringId);
  if (!offering) return { error: 'Shift no longer exists.' };

  await createOrUpdateClaim({
    id: randomId(),
    offering_id: offeringId,
    user_id: user.id,
    status: 'pending',
    decision_reason: null,
    created_at: new Date().toISOString(),
    decided_at: null,
  });
  revalidatePath('/driver');
  return {};
}

export async function unclaimShiftAction(offeringId: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'driver') return { error: 'Not authorized.' };
  if (!isSubmissionOpen()) return { error: 'Submissions are closed.' };
  await deleteClaim(offeringId, user.id);
  revalidatePath('/driver');
  return {};
}

export async function submitInspectionAction(
  photos: Record<PhotoLabel, string>,
): Promise<{ error?: string; ok?: boolean }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'driver') return { error: 'Not authorized.' };

  // Validate: all 5 labels present, each is a data URL
  for (const { key } of PHOTO_LABELS) {
    const v = photos[key];
    if (!v || !v.startsWith('data:image/')) {
      return { error: `Missing or invalid photo: ${key}` };
    }
  }

  const now = new Date();
  const date = todayISO(now);
  const existing = await getInspectionByUserAndDate(user.id, date);
  if (existing) return { error: 'You have already submitted today\u2019s inspection.' };

  const [claims, offerings] = await Promise.all([listClaimsForUser(user.id), listOfferings()]);
  const approvedOfferingIds = new Set(
    claims.filter((c) => c.status === 'approved').map((c) => c.offering_id),
  );
  const todaysApprovedOfferings = offerings.filter(
    (o) => o.date === date && approvedOfferingIds.has(o.id),
  );
  if (todaysApprovedOfferings.length === 0) {
    return {
      error: 'Inspection is only available when you have an approved shift scheduled for today.',
    };
  }

  const nowMinutes = minutesIntoDay(now);
  const withinWindow = todaysApprovedOfferings.some((o) => {
    const start = hhmmToMinutes(o.start_time);
    const end = hhmmToMinutes(o.end_time);
    const graceStart = Math.max(0, start - 30);
    return nowMinutes >= graceStart && nowMinutes <= end;
  });
  if (!withinWindow) {
    return {
      error: `You can submit from 30 minutes before your approved shift until shift end (${OPERATIONS_TIMEZONE}).`,
    };
  }

  const inspectionId = randomId();
  const inspection = {
    id: inspectionId,
    user_id: user.id,
    date,
    created_at: new Date().toISOString(),
  };
  const photoRecords = PHOTO_LABELS.map(({ key }) => ({
    id: randomId(),
    inspection_id: inspectionId,
    label: key,
    data_url: photos[key],
    created_at: new Date().toISOString(),
  }));
  const created = await createInspection(inspection, photoRecords);
  if (!created) return { error: 'You have already submitted today’s inspection.' };
  revalidatePath('/driver/inspection');
  revalidatePath('/driver/history');
  return { ok: true };
}
