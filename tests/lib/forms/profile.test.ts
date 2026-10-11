import {
  createPasswordSchema,
  createUserSchema,
  editUserSchema,
  firstRunAccountSchema,
} from "@/lib/forms/profile";
import { describe, expect, it } from "vitest";
import type { z } from "zod";

const t = (key: string) => key;
const TOO_SHORT = "a".repeat(11);
const LONG_ENOUGH = "a".repeat(12);

const editUserForm = (password: string) => ({
  username: "alice",
  displayName: "",
  avatarUrl: "",
  role: "user",
  password,
  confirmPassword: password,
  playerFilter: [],
});

const passwordIssues = (
  schema: z.ZodType,
  value: Record<string, unknown>,
  field: string,
) => {
  const result = schema.safeParse(value);
  if (result.success) return [];
  return result.error.issues
    .filter((issue) => issue.path[0] === field)
    .map((issue) => issue.message);
};

const cases = [
  {
    name: "createUserSchema",
    schema: createUserSchema(t),
    field: "password",
    form: (password: string) => ({
      username: "alice",
      displayName: "",
      password,
      confirmPassword: password,
      role: "user",
      playerFilter: [],
    }),
  },
  {
    name: "firstRunAccountSchema",
    schema: firstRunAccountSchema(t),
    field: "password",
    form: (password: string) => ({
      username: "alice",
      displayName: "",
      password,
      confirmPassword: password,
    }),
  },
  {
    name: "createPasswordSchema",
    schema: createPasswordSchema(t),
    field: "newPassword",
    form: (password: string) => ({
      newPassword: password,
      confirmPassword: password,
    }),
  },
  {
    name: "editUserSchema",
    schema: editUserSchema(t),
    field: "password",
    form: editUserForm,
  },
];

describe.each(cases)("$name password minimum", ({ schema, field, form }) => {
  it("rejects an 11-character password", () => {
    expect(passwordIssues(schema, form(TOO_SHORT), field)).toEqual([
      "auth.password_min_length",
    ]);
  });

  it("accepts a 12-character password", () => {
    expect(schema.safeParse(form(LONG_ENOUGH)).success).toBe(true);
  });
});

describe("editUserSchema", () => {
  it("accepts an empty password, which keeps the current one", () => {
    const result = editUserSchema(t).safeParse(editUserForm(""));
    expect(result.success).toBe(true);
  });
});
