'use server';

import { revalidatePath } from 'next/cache';
import { getCurrentUser } from '@/lib/auth';
import {
  createOffering,
  decideClaim,
  deleteOffering,
  findClaimById,
  getPlanningWeekMode,
  setPlanningWeekMode,
  setDriverStatus,
  type ClaimStatus,
  type DriverStatus,
  type PlanningWeekMode,
} from '@/lib/db';
import { getMondayOf } from '@/lib/week';

function randomId(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10);
}

export async function postOfferingAction(formData: FormData): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'Not authorized.' };

  const date = String(formData.get('date') || '');
  const start_time = String(formData.get('start_time') || '');
  const end_time = String(formData.get('end_time') || '');
  const label = String(formData.get('label') || '').trim();
  const notes = String(formData.get('notes') || '').trim() || null;

  if (!date || !start_time || !end_time || !label) {
    return { error: 'Date, start, end, and label are required.' };
  }
  if (start_time >= end_time) {
    return { error: 'Start time must be before end time.' };
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
  return {};
}

export async function deleteOfferingAction(id: string): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'Not authorized.' };
  await deleteOffering(id);
  revalidatePath('/admin/offerings');
  revalidatePath('/admin');
  return {};
}

export async function decideClaimAction(
  claimId: string,
  status: ClaimStatus,
  reason: string | null,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'Not authorized.' };
  const claim = await findClaimById(claimId);
  if (!claim) return { error: 'Claim not found.' };
  if (status === 'denied' && !reason) {
    return { error: 'A reason is required when denying.' };
  }
  await decideClaim(claimId, status, reason);
  revalidatePath('/admin');
  return {};
}

export async function setDriverStatusAction(
  userId: string,
  status: DriverStatus,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'Not authorized.' };
  try {
    await setDriverStatus(userId, status);
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Failed to update driver status.';
    return { error: message };
  }
  revalidatePath('/admin/drivers');
  revalidatePath('/admin');
  revalidatePath('/driver');
  return {};
}

export async function setPlanningWeekModeAction(
  mode: PlanningWeekMode,
): Promise<{ error?: string }> {
  const user = await getCurrentUser();
  if (!user || user.role !== 'admin') return { error: 'Not authorized.' };
  const current = await getPlanningWeekMode();
  if (current === mode) return {};
  await setPlanningWeekMode(mode);
  revalidatePath('/admin');
  revalidatePath('/admin/offerings');
  revalidatePath('/driver');
  return {};
}
