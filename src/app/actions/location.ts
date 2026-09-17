'use server';

import { revalidatePath } from 'next/cache';
import { z } from 'zod';

import { updateLocationSettings } from '@/core/repositories/profile.repository';
import { clearAllLocations } from '@/core/repositories/transaction.repository';
import { toUserId } from '@/core/types';
import { requireCurrentUser } from '@/lib/session';

// Not exported: a 'use server' module may only export async functions.
//
// The bounds are not decoration. A coordinate reaches this file from
// navigator.geolocation in a browser - a trust boundary - and the database
// CHECK is the second barrier, not the first.
const CoordinateSchema = z.object({
  latitude: z.number().min(-90).max(90),
  longitude: z.number().min(-180).max(180),
});

export interface LocationActionResult {
  readonly success: boolean;
  readonly error?: string;
  /** How many transactions lost their coordinate. Only set by the clear action. */
  readonly clearedCount?: number;
}

/**
 * Turns location capture on or off for future transactions.
 *
 * Off is the default and off stops all writing. It does not touch what is
 * already stored: erasing history is `clearLocationsAction`, on its own button,
 * with its own confirmation.
 */
export async function setLocationEnabledAction(
  enabled: boolean,
): Promise<LocationActionResult> {
  const session = await requireCurrentUser();

  try {
    await updateLocationSettings(toUserId(session.id), { enabled });
  } catch (error) {
    console.error('[location] failed to update the setting:', error);
    return { success: false, error: 'No se pudo guardar el ajuste.' };
  }

  revalidatePath('/perfil');
  return { success: true };
}

/**
 * Saves the point the app will call "home".
 *
 * One coordinate, no address and no geocoding: nothing about where the user
 * lives leaves this database, and the comparison that uses it is arithmetic in
 * core/geo.ts.
 */
export async function setHomeLocationAction(
  raw: { latitude: number; longitude: number } | null,
): Promise<LocationActionResult> {
  const session = await requireCurrentUser();

  let home: { latitude: number; longitude: number } | null = null;
  if (raw !== null) {
    const parsed = CoordinateSchema.safeParse(raw);
    if (!parsed.success) {
      return { success: false, error: 'La ubicación recibida no es válida.' };
    }
    home = parsed.data;
  }

  try {
    await updateLocationSettings(toUserId(session.id), { home });
  } catch (error) {
    console.error('[location] failed to save home:', error);
    return { success: false, error: 'No se pudo guardar la ubicación de casa.' };
  }

  revalidatePath('/perfil');
  return { success: true };
}

/** Erases every coordinate this user has stored. Irreversible, by design. */
export async function clearLocationsAction(): Promise<LocationActionResult> {
  const session = await requireCurrentUser();

  try {
    const clearedCount = await clearAllLocations(toUserId(session.id));
    revalidatePath('/perfil');
    revalidatePath('/dashboard');
    return { success: true, clearedCount };
  } catch (error) {
    console.error('[location] failed to clear stored locations:', error);
    return { success: false, error: 'No se pudieron borrar las ubicaciones.' };
  }
}
