import z from "zod";

// Schema for the "Add item from URL" dialog (radio / track) and the
// edit dialog it is reused for. URL and name are mandatory, image is optional.
export const manualLinkSchema = (t: (key: string) => string) =>
  z.object({
    url: z.string().trim().min(1, t("field_required")),
    name: z.string().trim().min(1, t("field_required")),
    image: z.string(),
  });
