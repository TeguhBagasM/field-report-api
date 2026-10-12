import { z } from "zod";

export const reportStatusSchema = z.enum(["pending", "approved", "rejected"], {
  error: "Status harus salah satu dari pending, approved, rejected",
});

// POST dan PUT memakai bentuk body yang sama: { name, description }.
export const reportBodySchema = z.object({
  name: z.string().trim().min(1, "Nama laporan wajib diisi").max(150, "Nama maksimal 150 karakter"),
  description: z.string().trim().min(1, "Deskripsi wajib diisi"),
});

export const listReportsQuerySchema = z.object({
  status: reportStatusSchema.optional(),
  page: z.coerce.number({ error: "Page harus angka" }).int().min(1).default(1),
  limit: z.coerce.number({ error: "Limit harus angka" }).int().min(1).max(100).default(10),
});

export type ReportBodyInput = z.infer<typeof reportBodySchema>;
export type ListReportsQuery = z.infer<typeof listReportsQuerySchema>;

export const updateStatusSchema = z.object({
  status: z.enum(["approved", "rejected"], {
    error: "Status harus approved atau rejected",
  }),
  note: z.string().trim().max(500, "Catatan maksimal 500 karakter").optional(),
});

export type UpdateStatusInput = z.infer<typeof updateStatusSchema>;
