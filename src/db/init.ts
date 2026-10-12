import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { pool } from "./pool.js";

async function main() {
  const sql = readFileSync(resolve(process.cwd(), "schema.sql"), "utf8");
  await pool.query(sql);
  console.log("✅ Schema berhasil dijalankan");
  await pool.end();
}

main().catch((e) => {
  console.error("❌ Gagal init DB:", e);
  process.exit(1);
});