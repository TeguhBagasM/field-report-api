import { Pool } from "pg";
import { env } from "../config/env.js";

export const pool = new Pool({
  connectionString: env.DATABASE_URL,
  ssl: { rejectUnauthorized: false }, // Neon butuh SSL
  max: 10,
});

pool.on("error", (err) => console.error("Unexpected PG error", err));