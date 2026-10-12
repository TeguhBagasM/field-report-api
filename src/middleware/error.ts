import type { NextFunction, Request, Response } from "express";
import { ZodError } from "zod";
import { env } from "../config/env.js";
import { HttpError } from "../utils/httpError.js";

export function notFoundHandler(_req: Request, res: Response): void {
  res.status(404).json({ message: "Tidak ditemukan" });
}

// Bentuk issue Zod v3 maupun v4 (v3: error.errors, v4: error.issues)
function formatZodErrors(err: ZodError): Array<{ field: string; message: string }> {
  const issues = (err as unknown as { issues?: unknown }).issues ??
    (err as unknown as { errors?: unknown }).errors;
  if (!Array.isArray(issues)) {
    return [{ field: "", message: err.message }];
  }
  return issues.map((issue) => {
    const item = issue as { path?: Array<string | number | symbol>; message?: unknown };
    const path = Array.isArray(item.path) ? item.path.map(String).join(".") : "";
    const message = typeof item.message === "string" ? item.message : "Input tidak valid";
    return { field: path, message };
  });
}

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export function errorHandler(
  err: unknown,
  _req: Request,
  res: Response,
  _next: NextFunction,
): void {
  if (err instanceof ZodError) {
    res.status(400).json({
      message: "Validasi gagal",
      errors: formatZodErrors(err),
    });
    return;
  }

  if (err instanceof HttpError) {
    const body: { message: string; errors?: unknown } = { message: err.message };
    if (err.errors !== undefined) {
      body.errors = err.errors;
    }
    res.status(err.status).json(body);
    return;
  }

  const message = err instanceof Error ? err.message : "Unknown error";
  console.error("[Unhandled error]", message, err);

  // Jangan bocorkan detail/stack ke klien saat production.
  if (env.NODE_ENV === "production") {
    res.status(500).json({ message: "Terjadi kesalahan pada server" });
    return;
  }

  res.status(500).json({ message: "Terjadi kesalahan pada server" });
}
