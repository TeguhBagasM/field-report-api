export {};

export type UserRole = "admin" | "pelapor" | "approver";

declare global {
  namespace Express {
    interface Request {
      user?: {
        id: number;
        role: UserRole;
        name: string;
      };
      /**
       * Hasil validasi zod untuk query string.
       * Dipakai karena di Express 5 `req.query` bersifat read-only (getter),
       * sehingga hasil parse tidak bisa menimpa `req.query` secara langsung.
       */
      validatedQuery?: unknown;
    }
  }
}
