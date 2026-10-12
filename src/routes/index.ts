import { Router } from "express";
import authRoutes from "./auth.routes.js";
import usersRoutes from "./users.routes.js";

const router = Router();

router.use("/auth", authRoutes);
router.use("/users", usersRoutes);

// Placeholder: rute reports akan dipasang di sini (Hari 1 berikutnya).

export default router;
