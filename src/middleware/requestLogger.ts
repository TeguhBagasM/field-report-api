import type { NextFunction, Request, Response } from "express";
import { env } from "../config/env.js";

/**
 * Middleware instrumentasi:
 * - Selalu pasang header Server-Timing (murah, aman untuk production).
 * - Log `method path status ms` hanya jika LOG_SLOW_QUERIES=true.
 * Tidak mengubah bentuk JSON respons.
 */
export function requestLogger(req: Request, res: Response, next: NextFunction): void {
  const start = process.hrtime.bigint();

  // Sisipkan Server-Timing sebelum header dikirim.
  const originalWriteHead = res.writeHead.bind(res);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  (res.writeHead as any) = function (...args: any[]) {
    try {
      const ms = Number(process.hrtime.bigint() - start) / 1e6;
      if (!res.headersSent || !res.getHeader("Server-Timing")) {
        res.setHeader("Server-Timing", `app;dur=${ms.toFixed(1)}`);
      }
    } catch {
      // abaikan — header hanya best-effort
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return (originalWriteHead as any)(...args);
  };

  res.on("finish", () => {
    if (!env.LOG_SLOW_QUERIES) return;
    const ms = Number(process.hrtime.bigint() - start) / 1e6;
    console.log(`[req] ${req.method} ${req.path} ${res.statusCode} ${ms.toFixed(1)}ms`);
  });

  next();
}

/**
 * Cache-Control: no-store untuk endpoint API ber-auth.
 * Dipasang setelah health check agar /health tetap boleh di-cache/CDN.
 */
export function apiNoStore(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader("Cache-Control", "no-store");
  next();
}
