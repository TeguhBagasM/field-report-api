import { Router } from "express";
import {
  changeStatusController,
  createReportController,
  getReportDetailController,
  listReportsController,
  updateReportController,
} from "../controllers/report.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import { idParamSchema } from "../schemas/common.schema.js";
import {
  listReportsQuerySchema,
  reportBodySchema,
  updateStatusSchema,
} from "../schemas/report.schema.js";

const reportsRoutes = Router();

reportsRoutes.use(authenticate);

reportsRoutes.post("/", requireRole("pelapor"), validate(reportBodySchema), createReportController);
reportsRoutes.get(
  "/",
  requireRole("pelapor", "approver", "admin"),
  validate(listReportsQuerySchema, "query"),
  listReportsController,
);
reportsRoutes.get(
  "/:id",
  requireRole("pelapor", "approver", "admin"),
  validate(idParamSchema, "params"),
  getReportDetailController,
);
reportsRoutes.put(
  "/:id",
  requireRole("pelapor"),
  validate(idParamSchema, "params"),
  validate(reportBodySchema),
  updateReportController,
);
reportsRoutes.patch(
  "/:id/status",
  requireRole("approver"),
  validate(idParamSchema, "params"),
  validate(updateStatusSchema),
  changeStatusController,
);

export default reportsRoutes;
