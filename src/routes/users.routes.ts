import { Router } from "express";
import {
  createUserController,
  listUsersController,
  updateUserController,
} from "../controllers/user.controller.js";
import { authenticate } from "../middleware/auth.js";
import { requireRole } from "../middleware/role.js";
import { validate } from "../middleware/validate.js";
import {
  createUserSchema,
  idParamSchema,
  updateUserSchema,
} from "../schemas/user.schema.js";

const usersRoutes = Router();

usersRoutes.use(authenticate, requireRole("admin"));

usersRoutes.get("/", listUsersController);
usersRoutes.post("/", validate(createUserSchema), createUserController);
usersRoutes.patch(
  "/:id",
  validate(idParamSchema, "params"),
  validate(updateUserSchema),
  updateUserController,
);

export default usersRoutes;
