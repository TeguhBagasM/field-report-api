import type { Request, Response } from "express";
import type { CreateUserInput, IdParam, UpdateUserInput } from "../schemas/user.schema.js";
import { createUser, listUsers, updateUser } from "../services/user.service.js";
import { asyncHandler, HttpError } from "../utils/httpError.js";

export const listUsersController = asyncHandler(
  async (_req: Request, res: Response): Promise<void> => {
    const users = await listUsers();
    res.json({ users });
  },
);

export const createUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    const user = await createUser(req.body as CreateUserInput);
    res.status(201).json({ user });
  },
);

export const updateUserController = asyncHandler(
  async (req: Request, res: Response): Promise<void> => {
    if (!req.user) {
      throw new HttpError(401, "Belum login");
    }
    const { id } = req.params as unknown as IdParam;
    const user = await updateUser(id, req.body as UpdateUserInput, req.user.id);
    res.json({ user });
  },
);
