import { describe, expect, it } from "vitest";
import type { CommandOptions } from "@/plugins/api/commandOptions";
import { AccountApi } from "@/plugins/api/account";

describe("account API", () => {
  it("sends role updates with the shared error-handling options", async () => {
    const calls: Array<{
      command: string;
      args?: Record<string, unknown>;
      options?: CommandOptions;
    }> = [];
    const api = new AccountApi(
      async <Result>(
        command: string,
        args?: Record<string, unknown>,
        options?: CommandOptions,
      ): Promise<Result> => {
        calls.push({ command, args, options });
        return { role_id: "custom" } as Result;
      },
      () => "test-device",
    );

    await api.updateRole("custom", { name: "Editors", scopes: ["read"] });

    expect(calls).toEqual([
      {
        command: "auth/role/update",
        args: { role_id: "custom", name: "Editors", scopes: ["read"] },
        options: { suppressGlobalError: true },
      },
    ]);
  });

  it("preserves token creation response validation", async () => {
    const api = new AccountApi(
      async <Result>(): Promise<Result> => {
        return { success: false, token: "" } as Result;
      },
      () => "test-device",
    );

    await expect(api.createToken("app")).rejects.toThrow(
      "Failed to create token",
    );
  });
});
