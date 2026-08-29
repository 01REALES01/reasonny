/**
 * Branded nominal types and core domain identifiers.
 *
 * WHY BRANDED TYPES
 * ------------------
 * In TypeScript, `type UserId = string` is a type alias, not a distinct type.
 * Without branding, passing an `accountId` to a function expecting a `userId`
 * compiles without error because both are strings.
 *
 * Branded types attach a unique compile-time tag to primitive types. This makes
 * it structurally impossible to accidentally swap IDs of different entities
 * without an explicit cast or validation helper.
 */

declare const __brand: unique symbol;

export type Brand<K, T> = K & { readonly [__brand]: T };

// Core entity identifiers (UUID strings at runtime)
export type UserId = Brand<string, 'UserId'>;
export type AccountId = Brand<string, 'AccountId'>;
export type CategoryId = Brand<string, 'CategoryId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type ApiKeyId = Brand<string, 'ApiKeyId'>;

/**
 * UUID validation regex (v4 and v7 compliant).
 */
const UUID_REGEX =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function assertUuid(value: string, typeName: string): void {
  if (!UUID_REGEX.test(value)) {
    throw new TypeError(`Invalid ${typeName}: "${value}" is not a valid UUID.`);
  }
}

/**
 * Validated constructors for branded IDs.
 * Runtime validation ensures malformed strings never enter the domain layer.
 */
export function toUserId(id: string): UserId {
  assertUuid(id, 'UserId');
  return id as UserId;
}

export function toAccountId(id: string): AccountId {
  assertUuid(id, 'AccountId');
  return id as AccountId;
}

export function toCategoryId(id: string): CategoryId {
  assertUuid(id, 'CategoryId');
  return id as CategoryId;
}

export function toTransactionId(id: string): TransactionId {
  assertUuid(id, 'TransactionId');
  return id as TransactionId;
}

export function toApiKeyId(id: string): ApiKeyId {
  assertUuid(id, 'ApiKeyId');
  return id as ApiKeyId;
}
