import type { NextFunction, Request, Response } from "express";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { pool } from "../db/pool.js";
import { HttpError, asyncHandler } from "../utils/httpError.js";

type JwtPayload = {
  id?: number;
  userId?: number;
  sub?: number | string;
};

function extractUserId(payload: unknown): number | null {
  if (typeof payload !== "object" || payload === null) return null;
  const p = payload as JwtPayload;
  const raw = p.id ?? p.userId ?? p.sub;
  const id = typeof raw === "string" ? Number(raw) : raw;
  return typeof id === "number" && Number.isInteger(id) ? id : null;
}

/**
 * Memverifikasi JWT dari header Authorization: Bearer <token>,
 * memastikan user masih ada di DB dan is_active = true,
 * lalu mengisi req.user. Gagal -> 401.
 */
export const authenticate = asyncHandler(
  async (req: Request, _res: Response, next: NextFunction): Promise<void> => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith("Bearer ")) {
      throw new HttpError(401, "Token tidak ditemukan");
    }

    const token = header.slice("Bearer ".length).trim();
    if (!token) {
      throw new HttpError(401, "Token tidak ditemukan");
    }

    let payload: unknown;
    try {
      payload = jwt.verify(token, env.JWT_SECRET);
    } catch {
      throw new HttpError(401, "Token tidak valid");
    }

    const userId = extractUserId(payload);
    if (userId === null) {
      throw new HttpError(401, "Token tidak valid");
    }

    const { rows } = await pool.query(
      "SELECT id, name, role, is_active FROM users WHERE id = $1",
      [userId],
    );
    const user = rows[0] as
      | { id: number; name: string; role: "admin" | "pelapor" | "approver"; is_active: boolean }
      | undefined;

    if (!user || user.is_active !== true) {
      throw new HttpError(401, "Token tidak valid");
    }

    req.user = { id: user.id, role: user.role, name: user.name };
    next();
  },
);
