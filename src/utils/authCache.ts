import type { UserRole } from "../types/express.js";
import { isServerless } from "../db/pool.js";

export type CachedAuthUser = { id: number; name: string; role: UserRole };

const TTL_MS = 30_000;
const cache = new Map<number, { user: CachedAuthUser; isActive: boolean; expiresAt: number }>();

/**
 * Cache in-memory per user (TTL 30 detik).
 * AKTIF hanya di server biasa. Di serverless (Vercel) otomatis nonaktif:
 * memori antar-invocasi tidak berbagi (isolate bisa freeze/dispose),
 * sehingga hit-rate ~0 tapi risiko stale justru naik. Auth tetap 1 query
 * ringan per request di mode tersebut (lihat middleware/auth.ts).
 */
export function getAuthCache(id: number): { user: CachedAuthUser; isActive: boolean } | undefined {
  if (isServerless) return undefined;
  const hit = cache.get(id);
  if (!hit) return undefined;
  if (Date.now() > hit.expiresAt) {
    cache.delete(id);
    return undefined;
  }
  return { user: hit.user, isActive: hit.isActive };
}

export function setAuthCache(
  id: number,
  user: CachedAuthUser,
  isActive: boolean,
): void {
  if (isServerless) return;
  cache.set(id, { user, isActive, expiresAt: Date.now() + TTL_MS });
}

/** Panggil setiap ada perubahan user (update / nonaktif) agar tidak stale. */
export function invalidateAuthCache(id: number): void {
  cache.delete(id);
}
