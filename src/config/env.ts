import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  PORT: z.coerce.number().default(4000),
  NODE_ENV: z.enum(["development", "production", "test"]).default("development"),
  DATABASE_URL: z.string().min(1, "DATABASE_URL wajib diisi"),
  JWT_SECRET: z.string().min(16, "JWT_SECRET minimal 16 karakter"),
  JWT_EXPIRES_IN: z.string().default("1d"),
  CORS_ORIGIN: z.string().default("http://localhost:5173"),
  // Instrumentasi (request log + slow query) hanya aktif jika "true".
  // Default "false" agar aman & senyap di production.
  LOG_SLOW_QUERIES: z
    .string()
    .optional()
    .default("false")
    .transform((v) => v === "true"),
});

const parsed = schema.safeParse(process.env);
if (!parsed.success) {
  console.error("Env tidak valid:", parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const env = parsed.data;