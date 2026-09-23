/**
 * Category repository.
 *
 * Manages user-isolated categories and default per-user seed categories.
 */
import { and, eq, isNull, sql } from 'drizzle-orm';

import type { CategoryId, UserId } from '@/core/types';
import { getDb } from '@/infrastructure/db/client';
import { categories, transactions } from '@/infrastructure/db/schema';

export type CategoryRow = typeof categories.$inferSelect;
export type CategoryType = 'expense' | 'income';

export interface CreateCategoryInput {
  readonly name: string;
  readonly type: CategoryType;
  readonly icon?: string;
  readonly color?: string;
  readonly createdFromSeed?: boolean;
}

export interface UpdateCategoryInput {
  readonly name?: string;
  readonly icon?: string;
  readonly color?: string;
}

export const DEFAULT_SEED_CATEGORIES: ReadonlyArray<{
  readonly name: string;
  readonly type: CategoryType;
  readonly icon: string;
  readonly color: string;
}> = [
  // Expenses
  { name: 'Supermercado', type: 'expense', icon: 'ShoppingCart', color: '#10B981' },
  { name: 'Restaurantes y Café', type: 'expense', icon: 'Utensils', color: '#F59E0B' },
  { name: 'Transporte', type: 'expense', icon: 'Car', color: '#3B82F6' },
  { name: 'Vivienda y Servicios', type: 'expense', icon: 'Home', color: '#8B5CF6' },
  { name: 'Salud', type: 'expense', icon: 'HeartPulse', color: '#EF4444' },
  { name: 'Entretenimiento', type: 'expense', icon: 'Tv', color: '#EC4899' },
  { name: 'Compras', type: 'expense', icon: 'ShoppingBag', color: '#06B6D4' },
  { name: 'Suscripciones', type: 'expense', icon: 'CreditCard', color: '#6366F1' },
  { name: 'Educación', type: 'expense', icon: 'GraduationCap', color: '#14B8A6' },
  { name: 'Otros Gastos', type: 'expense', icon: 'MoreHorizontal', color: '#6B7280' },

  // Income
  { name: 'Salario', type: 'income', icon: 'Briefcase', color: '#10B981' },
  { name: 'Honorarios / Freelance', type: 'income', icon: 'Laptop', color: '#3B82F6' },
  { name: 'Inversiones', type: 'income', icon: 'TrendingUp', color: '#8B5CF6' },
  { name: 'Otros Ingresos', type: 'income', icon: 'PlusCircle', color: '#6B7280' },
];

export async function listCategories(
  userId: UserId,
  options?: { readonly type?: CategoryType },
): Promise<CategoryRow[]> {
  const db = getDb();
  const conditions = [eq(categories.userId, userId)];

  if (options?.type) {
    conditions.push(eq(categories.type, options.type));
  }

  return db
    .select()
    .from(categories)
    .where(and(...conditions))
    .orderBy(categories.name);
}

/**
 * The categories this user reaches for most, most-used first.
 *
 * For a keyboard in a notification banner. A phone shows three buttons before
 * it starts hiding them, and a user with fifteen categories would get a wall
 * nobody taps - so the three that cover most of their spending go on top and
 * the rest live behind "more".
 *
 * Ordered by how often each has actually been chosen, so the list improves on
 * its own instead of being a guess frozen at seed time. Ties break by name, so
 * the keyboard does not reshuffle between two equally-used categories from one
 * message to the next - a button that moves is a button tapped by mistake.
 */
export async function listMostUsedCategories(
  userId: UserId,
  type: CategoryType,
  limit = 3,
): Promise<CategoryRow[]> {
  const db = getDb();

  return db
    .select({
      id: categories.id,
      userId: categories.userId,
      name: categories.name,
      icon: categories.icon,
      color: categories.color,
      type: categories.type,
      createdFromSeed: categories.createdFromSeed,
      createdAt: categories.createdAt,
    })
    .from(categories)
    .leftJoin(
      transactions,
      and(
        eq(transactions.categoryId, categories.id),
        eq(transactions.userId, userId),
        isNull(transactions.deletedAt),
      ),
    )
    .where(and(eq(categories.userId, userId), eq(categories.type, type)))
    .groupBy(categories.id)
    .orderBy(sql`COUNT(${transactions.id}) DESC`, categories.name)
    .limit(limit);
}

export async function getCategory(
  userId: UserId,
  categoryId: CategoryId,
): Promise<CategoryRow | null> {
  const db = getDb();
  const [row] = await db
    .select()
    .from(categories)
    .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)))
    .limit(1);
  return row ?? null;
}

export async function createCategory(
  userId: UserId,
  input: CreateCategoryInput,
): Promise<CategoryRow> {
  const db = getDb();
  const [row] = await db
    .insert(categories)
    .values({
      userId,
      name: input.name,
      type: input.type,
      icon: input.icon ?? 'Tag',
      color: input.color ?? '#6B7280',
      createdFromSeed: input.createdFromSeed ?? false,
    })
    .returning();

  if (!row) {
    throw new Error(`Failed to create category "${input.name}" for user ${userId}`);
  }
  return row;
}

export async function updateCategory(
  userId: UserId,
  categoryId: CategoryId,
  input: UpdateCategoryInput,
): Promise<CategoryRow | null> {
  const db = getDb();
  const [row] = await db
    .update(categories)
    .set({
      ...(input.name !== undefined ? { name: input.name } : {}),
      ...(input.icon !== undefined ? { icon: input.icon } : {}),
      ...(input.color !== undefined ? { color: input.color } : {}),
    })
    .where(and(eq(categories.userId, userId), eq(categories.id, categoryId)))
    .returning();

  return row ?? null;
}

/**
 * Seeds default categories for a new profile.
 * Categories are per-user copies (`createdFromSeed = true`), never shared rows.
 */
export async function seedDefaultCategories(userId: UserId): Promise<CategoryRow[]> {
  const db = getDb();
  const rows = await db
    .insert(categories)
    .values(
      DEFAULT_SEED_CATEGORIES.map((cat) => ({
        userId,
        name: cat.name,
        type: cat.type,
        icon: cat.icon,
        color: cat.color,
        createdFromSeed: true,
      })),
    )
    .onConflictDoNothing()
    .returning();

  return rows;
}
