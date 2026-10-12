import type { Request, Response } from "express";
import type { IdParam } from "../schemas/common.schema.js";
import type {
  ListReportsQuery,
  ReportBodyInput,
} from "../schemas/report.schema.js";
import {
  createReport,
  getReportDetail,
  listReports,
  updateReport,
} from "../services/report.service.js";
import { asyncHandler, HttpError } from "../utils/httpError.js";

function requireLogin(req: Request): { id: number; role: "admin" | "pelapor" | "approver" } {
  if (!req.user) {
    throw new HttpError(401, "Belum login");
  }
  return req.user;
}

export const createReportController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = requireLogin(req);
    const report = await createReport(req.body as ReportBodyInput, user.id);
    res.status(201).json(report);
  },
);

export const listReportsController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = requireLogin(req);
    const query = req.validatedQuery as ListReportsQuery;
    const result = await listReports({
      ...query,
      requesterId: user.id,
      requesterRole: user.role,
    });
    res.json(result);
  },
);

export const getReportDetailController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = requireLogin(req);
    const { id } = req.params as unknown as IdParam;
    const report = await getReportDetail(id, user);
    res.json(report);
  },
);

export const updateReportController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = requireLogin(req);
    const { id } = req.params as unknown as IdParam;
    const report = await updateReport(id, user.id, req.body as ReportBodyInput);
    res.json(report);
  },
);
