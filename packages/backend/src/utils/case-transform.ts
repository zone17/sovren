/**
 * Case Transform Utilities
 *
 * Converts between snake_case (Supabase/PostgreSQL) and camelCase (API/TypeScript).
 * Used by createApiResponse() to ensure API responses match shared type contracts.
 */

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return (
    typeof value === 'object' && value !== null && !Array.isArray(value) && !(value instanceof Date)
  );
}

function toSnakeCase(str: string): string {
  return str.replace(/[A-Z]/g, (letter) => `_${letter.toLowerCase()}`);
}

function toCamelCase(str: string): string {
  return str.replace(/_([a-z])/g, (_, letter: string) => letter.toUpperCase());
}

/**
 * Deep-transforms all keys in an object from snake_case to camelCase.
 * Handles nested objects, arrays, nulls, Dates, and primitives.
 *
 * @example
 * snakeToCamel({ creator_id: 'abc', line_items: [{ unit_price_sats: 100 }] })
 * // => { creatorId: 'abc', lineItems: [{ unitPriceSats: 100 }] }
 */
export function snakeToCamel<T = unknown>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map((item) => snakeToCamel(item)) as T;
  }

  if (!isPlainObject(data)) {
    return data as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[toCamelCase(key)] = snakeToCamel(value);
  }
  return result as T;
}

/**
 * Deep-transforms all keys in an object from camelCase to snake_case.
 * Used for converting API request bodies to DB row format.
 *
 * @example
 * camelToSnake({ creatorId: 'abc', lineItems: [{ unitPriceSats: 100 }] })
 * // => { creator_id: 'abc', line_items: [{ unit_price_sats: 100 }] }
 */
export function camelToSnake<T = unknown>(data: unknown): T {
  if (Array.isArray(data)) {
    return data.map((item) => camelToSnake(item)) as T;
  }

  if (!isPlainObject(data)) {
    return data as T;
  }

  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(data)) {
    result[toSnakeCase(key)] = camelToSnake(value);
  }
  return result as T;
}
