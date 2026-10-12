import type { NextFunction, Request, Response } from "express";

export class HttpError extends Error {
  status: number;
  errors?: unknown;

  constructor(status: number, message: string, errors?: unknown) {
    super(message);
    this.name = "HttpError";
    this.status = status;
    if (errors !== undefined) {
      this.errors = errors;
    }
    // Menjaga prototype chain saat target ES5/ES2022 transpile
    Object.setPrototypeOf(this, HttpError.prototype);
  }
}

type AsyncHandlerFn = (
  req: Request,
  res: Response,
  next: NextFunction,
) => Promise<unknown>;

/**
 * Wrapper agar error dari handler async (rejected promise / throw)
 * diteruskan ke error handler Express.
 * Aman dipakai di Express v4 maupun v5.
 */
export function asyncHandler(fn: AsyncHandlerFn) {
  return (req: Request, res: Response, next: NextFunction): void => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
}
