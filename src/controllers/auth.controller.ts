import type { Request, Response } from "express";
import { getCurrentUser, login } from "../services/auth.service.js";
import { asyncHandler, HttpError } from "../utils/httpError.js";

export const loginController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const { email, password } = req.body as { email: string; password: string };
    const result = await login(email, password);
    res.json(result);
  },
);

export const meController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new HttpError(401, "Belum login");
    }
    const user = await getCurrentUser(req.user.id);
    res.json({ user });
  },
);
