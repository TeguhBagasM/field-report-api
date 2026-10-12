import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import { env } from "./config/env.js";
import { pool } from "./db/pool.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { apiNoStore, requestLogger } from "./middleware/requestLogger.js";
import router from "./routes/index.js";

export const app = express();

// Jangan bocorkan versi framework.
app.disable("x-powered-by");

app.use(helmet());
app.use(cors({ origin: env.CORS_ORIGIN }));
app.use(compression());
app.use(express.json());
app.use(requestLogger);

// Health tanpa DB (liveness; bentuk JSON lama dipertahankan).
app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

// Health dengan DB (readiness / keep-alive ping).
app.get("/api/health/db", async (_req, res) => {
  const start = process.hrtime.bigint();
  try {
    await pool.query("SELECT 1");
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    res.json({ status: "ok", db: "up", ms: Math.round(ms * 10) / 10 });
  } catch {
    res.status(503).json({ status: "error", db: "down" });
  }
});

// Semua endpoint API ber-auth: jangan izinkan cache di sisi klien/proxy.
app.use("/api", apiNoStore);
app.use("/api", router);

app.use(notFoundHandler);
app.use(errorHandler);
