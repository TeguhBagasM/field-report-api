import { Router } from "express";
import authRoutes from "./auth.routes.js";
import reportsRoutes from "./reports.routes.js";
import usersRoutes from "./users.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);
router.use("/reports", reportsRoutes);

export default router;
