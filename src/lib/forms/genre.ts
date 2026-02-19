import z from "zod";

export const addGenreSchema = (t: (key: string) => string) =>
  z.object({
    name: z
      .string()
      .min(1, t("field_required"))
      .max(100, "Name must be at most 100 characters."),
    sortName: z.string().max(100, "Sort name must be at most 100 characters."),
    description: z
      .string()
      .max(500, "Description must be at most 500 characters."),
  });
