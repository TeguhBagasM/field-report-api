import type { Request, Response } from "express";
import { getDashboardSummary } from "../services/dashboard.service.js";
import { asyncHandler, HttpError } from "../utils/httpError.js";

export const getDashboardSummaryController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new HttpError(401, "Belum login");
    }
    const summary = await getDashboardSummary(req.user);
    res.json(summary);
  },
);
