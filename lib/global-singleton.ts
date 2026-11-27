/**
 * Process-wide singleton. In-memory live state (occupancy cache, simulator) must survive
 * hot reloads and be shared between route handlers, Server Components and Server Actions.
 */
export function globalSingleton<T>(key: string, create: () => T): T {
  const store = globalThis as unknown as Record<string, T | undefined>;
  const existing = store[key];
  if (existing !== undefined) return existing;
  const created = create();
  store[key] = created;
  return created;
}
