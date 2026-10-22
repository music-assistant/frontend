import z from "zod";

export const createPasswordSchema = (t: (key: string) => string) =>
  z
    .object({
      newPassword: z.string().max(128, t("auth.password_max_length")),
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
      .min(2, t("auth.username_min_length"))
      .max(50, t("auth.username_max_length")),
    displayName: z.string().max(100, t("auth.display_name_max_length")),
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

export const createUserSchema = (t: (key: string) => string) =>
  z
    .object({
      username: z
        .string()
        .min(2, t("auth.username_min_length"))
        .max(50, t("auth.username_max_length")),
      displayName: z.string().max(100, t("auth.display_name_max_length")),
      password: z
        .string()
        .min(8, t("auth.password_min_length"))
        .max(128, t("auth.password_max_length")),
      confirmPassword: z.string(),
      role: z.string().min(1),
      playerFilter: z.array(z.string()),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwords_must_match"),
      path: ["confirmPassword"],
    });

export const editUserSchema = (t: (key: string) => string) =>
  z
    .object({
      username: z
        .string()
        .min(2, t("auth.username_min_length"))
        .max(50, t("auth.username_max_length")),
      displayName: z.string().max(100, t("auth.display_name_max_length")),
      avatarUrl: z
        .string()
        .refine((val) => !val || z.string().url().safeParse(val).success, {
          message: "Invalid URL format.",
        }),
      role: z.string().min(1),
      password: z.string().max(128, t("auth.password_max_length")),
      confirmPassword: z.string(),
      playerFilter: z.array(z.string()),
    })
    .refine(
      (data) => !data.password || data.password === data.confirmPassword,
      {
        message: t("auth.passwords_must_match"),
        path: ["confirmPassword"],
      },
    );

export const firstRunAccountSchema = (t: (key: string) => string) =>
  z
    .object({
      username: z
        .string()
        .trim()
        .min(2, t("auth.username_min_length"))
        .max(50, t("auth.username_max_length")),
      displayName: z.string().max(100, t("auth.display_name_max_length")),
      password: z
        .string()
        .min(8, t("auth.password_min_length"))
        .max(128, t("auth.password_max_length")),
      confirmPassword: z.string(),
    })
    .refine((data) => data.password === data.confirmPassword, {
      message: t("auth.passwords_must_match"),
      path: ["confirmPassword"],
    });
