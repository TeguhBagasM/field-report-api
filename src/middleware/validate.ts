import type { NextFunction, Request, Response } from "express";
import type { ZodType } from "zod";

type ValidateSource = "body" | "query" | "params";

/**
 * Validasi request memakai schema zod.
 * - source 'body'   -> hasil parse menimpa req.body
 * - source 'params' -> hasil parse digabungkan ke req.params
 * - source 'query'  -> hasil parse disimpan di req.validatedQuery
 *   (req.query read-only di Express 5, tidak bisa ditimpa langsung).
 * Error validasi (ZodError) dilempar ke errorHandler global -> 400.
 */
export function validate(schema: ZodType, source: ValidateSource = "body") {
  return (req: Request, _res: Response, next: NextFunction): void => {
    const data =
      source === "body" ? req.body : source === "query" ? req.query : req.params;

    const parsed = schema.parse(data);

    if (source === "body") {
      req.body = parsed;
    } else if (source === "query") {
      req.validatedQuery = parsed;
    } else {
      Object.assign(req.params, parsed);
    }

    next();
  };
}
