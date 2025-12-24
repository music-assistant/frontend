import z from "zod";

export const createPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      newPassword: z
        .string()
        .max(128, "Password must be at most 128 characters."),
      confirmPassword: z.string(),
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
      message: t("auth.passwords_must_match"),
      path: ["confirmPassword"],
    });

export const profileSettingsSchema = (t: (key: string) => string) =>
  z.object({
    username: z
      .string()
      .min(3, t("auth.username_min_length"))
      .max(50, "Username must be at most 50 characters."),
    displayName: z
      .string()
      .max(100, "Display name must be at most 100 characters."),
    avatarUrl: z
      .string()
      .refine((val) => !val || z.string().url().safeParse(val).success, {
        message: "Invalid URL format.",
      }),
    role: z.string(),
  });

export const tokenNameSchema = (t: (key: string) => string) =>
  z
    .string()
    .min(1, t("auth.field_required"))
    .max(100, "Token name must be at most 100 characters.");

export const createTokenSchema = (t: (key: string) => string) =>
  z.object({
    tokenName: tokenNameSchema(t),
  });
