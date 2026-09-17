/**
 * Converts a camelCase object to snake_case for Supabase column compatibility.
 * Arrays and nested objects are preserved as-is (stored as jsonb / array columns).
 */
export function toSnake(obj: object): Record<string, unknown> {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    const snakeKey = key.replace(/[A-Z]/g, (l) => `_${l.toLowerCase()}`);
    result[snakeKey] = value;
  }
  return result;
}

/**
 * Converts a snake_case row from Supabase back to camelCase for TypeScript models.
 */
export function toCamel<T>(row: Record<string, unknown>): T {
  const result: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(row)) {
    const camelKey = key.replace(/_([a-z])/g, (_, l) => l.toUpperCase());
    result[camelKey] = value;
  }
  return result as T;
}

/** Map an array of snake_case rows to camelCase models */
export function mapRows<T>(rows: Record<string, unknown>[]): T[] {
  return rows.map((r) => toCamel<T>(r));
}
