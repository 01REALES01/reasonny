'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { updateProfileName } from '@/core/repositories/profile.repository';
import { toUserId } from '@/core/types';
import { markOnboardingSeen } from '@/lib/onboarding';
import { requireCurrentUser } from '@/lib/session';

// Not exported: a 'use server' module may only export async functions.
//
// Trimmed before validation, so a name of three spaces is empty rather than
// three characters long. An empty string clears the name and returns the app to
// addressing the user by their email handle, which is a legitimate choice - so
// it is stored as NULL rather than rejected.
const DisplayNameSchema = z
  .string()
  .trim()
  .max(60, 'El nombre no puede pasar de 60 caracteres.');

export interface ProfileActionResult {
  readonly success: boolean;
  readonly error?: string;
}

/**
 * Records that the welcome flow has been shown, so /dashboard stops redirecting
 * into it. Called on finish AND on skip - skipping is an answer.
 */
export async function completeOnboardingAction(): Promise<ProfileActionResult> {
  await requireCurrentUser();
  await markOnboardingSeen();
  revalidatePath('/dashboard');
  return { success: true };
}

/**
 * Sets the name the app greets the user by.
 *
 * The name is the only thing this writes. Email comes from the identity
 * provider and currency and timezone drive money aggregation, so neither
 * belongs behind a free-text field in the same form.
 */
export async function updateDisplayNameAction(
  rawName: string,
): Promise<ProfileActionResult> {
  const session = await requireCurrentUser();
  const parsed = DisplayNameSchema.safeParse(rawName);

  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message ?? 'Nombre inválido.',
    };
  }

  try {
    await updateProfileName(toUserId(session.id), parsed.data || null);
  } catch (error) {
    console.error('[profile] failed to update display name:', error);
    return { success: false, error: 'No se pudo guardar. Intenta de nuevo.' };
  }

  // The greeting is rendered on the dashboard, so that page has to be rebuilt
  // for the change to be visible without a hard reload.
  revalidatePath('/dashboard');
  revalidatePath('/perfil');

  return { success: true };
}
