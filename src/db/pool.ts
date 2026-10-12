import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * Mode deployment:
 * - Lokal / VPS (`npm start`, src/server.ts dengan app.listen) = server biasa.
 * - Vercel (`api/index.ts` + vercel.json rewrites) = serverless function.
 * Deteksi via env bawaan Vercel / Lambda. Di serverless, pool & cache
 * in-memory harus minimal karena tiap invocasi bisa jadi isolate baru.
 */
export const isServerless =
  Boolean(process.env.VERCEL) ||
  Boolean(process.env.VERCEL_ENV) ||
  Boolean(process.env.AWS_LAMBDA_FUNCTION_NAME);

/** Paksa host Neon lewat pooler (`-pooler`) bila URL belum menggunakannya. */
function toPoolerConnectionString(raw: string): string {
  try {
    const u = new URL(raw);
    if (u.hostname.endsWith(".neon.tech") && !u.hostname.includes("-pooler")) {
      const parts = u.hostname.split(".");
      parts[0] = `${parts[0]}-pooler`;
      u.hostname = parts.join(".");
    }
    // Hapus `sslmode` dari URL: TLS sudah diatur eksplisit via opsi `ssl`
    // di bawah (opsi eksplisit selalu menang atas hasil parse URL di pg),
    // dan membiarkannya memicu deprecation warning pg-connection-string
    // tentang `sslmode=require`. Perilaku koneksi tidak berubah.
    u.searchParams.delete("sslmode");
    return u.toString();
  } catch {
    return raw;
  }
}

export const pool = new Pool({
  connectionString: toPoolerConnectionString(env.DATABASE_URL),
  ssl: { rejectUnauthorized: false }, // Neon butuh SSL
  // Server biasa (koneksi persisten): 10. Serverless (ephemeral): 2.
  max: isServerless ? 2 : 10,
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 10000,
});

pool.on("error", (err) => console.error("Unexpected PG error", err));

// Instrumentasi slow query (>100ms), aktif hanya jika LOG_SLOW_QUERIES=true.
// Membungkus pool.query tanpa mengubah signature / perilaku.
const originalQuery = pool.query.bind(pool);
type QueryArgs = Parameters<typeof originalQuery>;
// eslint-disable-next-line @typescript-eslint/no-explicit-any
async function timedQuery(...args: QueryArgs): Promise<any> {
  const text = typeof args[0] === "string" ? args[0] : (args[0] as { text?: string })?.text;
  const start = process.hrtime.bigint();
  try {
    return await (originalQuery as (...a: QueryArgs) => Promise<unknown>)(...args);
  } finally {
    if (env.LOG_SLOW_QUERIES) {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (ms > 100) {
        const preview = typeof text === "string" ? text.replace(/\s+/g, " ").slice(0, 160) : "?";
        console.warn(`[slow-query] ${ms.toFixed(1)}ms :: ${preview}`);
      }
    }
  }
}
pool.query = timedQuery as typeof pool.query;

/**
 * Warm-up koneksi (SELECT 1) — hanya dipanggil dari src/server.ts
 * (server biasa). Jangan dipanggil dari handler serverless.
 */
export async function warmupPool(): Promise<void> {
  if (isServerless) return;
  await pool.query("SELECT 1");
}
