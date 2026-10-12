import { z } from "zod";

export const userRoleSchema = z.enum(["admin", "pelapor", "approver"], {
  error: "Role harus salah satu dari admin, pelapor, approver",
});

export const createUserSchema = z.object({
  name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
  email: z.string().trim().toLowerCase().pipe(z.email("Email tidak valid")),
  password: z.string().min(8, "Password minimal 8 karakter"),
  role: userRoleSchema,
});

export const updateUserSchema = z
  .object({
    name: z.string().trim().min(1, "Nama wajib diisi").max(100, "Nama maksimal 100 karakter"),
    role: userRoleSchema,
    isActive: z.boolean(),
    password: z.string().min(8, "Password minimal 8 karakter"),
  })
  .partial()
  .refine((data) => Object.keys(data).length > 0, {
    message: "Minimal satu field harus diisi",
  });

// Dipindah ke common.schema.ts agar bisa dipakai ulang modul lain.
export { idParamSchema, type IdParam } from "./common.schema.js";

export type CreateUserInput = z.infer<typeof createUserSchema>;
export type UpdateUserInput = z.infer<typeof updateUserSchema>;
