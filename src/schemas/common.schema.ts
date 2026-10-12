import { z } from "zod";

export const idParamSchema = z.object({
  id: z.coerce
    .number({ error: "ID harus angka" })
    .int("ID harus bilangan bulat")
    .positive("ID harus positif"),
});

export type IdParam = z.infer<typeof idParamSchema>;
