import type { NextFunction, Request, Response } from "express";
import { HttpError } from "../utils/httpError.js";
import type { UserRole } from "../types/express.js";

/**
 * Membatasi akses berdasarkan role. Dipakai setelah `authenticate`.
 * Role tidak cocok -> 403.
 */
export function requireRole(...roles: UserRole[]) {
  return (req: Request, _res: Response, next: NextFunction): void => {
    if (!req.user) {
      throw new HttpError(401, "Belum login");
    }
    if (!roles.includes(req.user.role)) {
      throw new HttpError(403, "Akses ditolak");
    }
    next();
  };
}
