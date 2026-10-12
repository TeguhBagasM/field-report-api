import { Router } from "express";
import { loginController, meController } from "../controllers/auth.controller.js";
import { authenticate } from "../middleware/auth.js";
import { validate } from "../middleware/validate.js";
import { loginSchema } from "../schemas/auth.schema.js";

const authRoutes = Router();

authRoutes.post("/login", validate(loginSchema), loginController);
authRoutes.get("/me", authenticate, meController);

export default authRoutes;
