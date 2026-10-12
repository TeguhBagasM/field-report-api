import { readdirSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import { pool } from "./pool.js";

/**
 * Runner migrasi manual: `npm run db:migrate`.
 * Menjalankan semua file migrations/*.sql berurutan dalam satu koneksi.
 * TIDAK dipanggil otomatis saat startup (aman untuk serverless).
 */
async function main(): Promise<void> {
  const dir = resolve(process.cwd(), "migrations");
  let files: string[] = [];
  try {
    files = readdirSync(dir)
      .filter((f) => f.endsWith(".sql"))
      .sort();
  } catch {
    console.log("Tidak ada direktori migrations/ — lewati.");
    await pool.end();
    return;
  }
  if (files.length === 0) {
    console.log("Tidak ada file migrasi — lewati.");
    await pool.end();
    return;
  }
  for (const f of files) {
    const sql = readFileSync(join(dir, f), "utf8");
    console.log(`Menjalankan ${f} ...`);
    await pool.query(sql);
    console.log(`OK ${f}`);
  }
  await pool.end();
}

main().catch(async (e) => {
  console.error("Gagal migrasi:", e);
  await pool.end().catch(() => undefined);
  process.exit(1);
});
