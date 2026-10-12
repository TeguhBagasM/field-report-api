import { Router } from "express";
import { getDashboardSummaryController } from "../controllers/dashboard.controller.js";
import { authenticate } from "../middleware/auth.js";

const dashboardRoutes = Router();

dashboardRoutes.get("/summary", authenticate, getDashboardSummaryController);

export default dashboardRoutes;
