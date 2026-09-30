import { HOMEASSISTANT_SYSTEM_USER, isSystemUser } from "@/helpers/users";
import { user } from "../fixtures/user";
import { describe, expect, it } from "vitest";

describe("isSystemUser", () => {
  it("is true for the Home Assistant system account", () => {
    expect(isSystemUser(user({ username: HOMEASSISTANT_SYSTEM_USER }))).toBe(
      true,
    );
  });

  it("is false for a regular user", () => {
    expect(isSystemUser(user({ username: "marcel" }))).toBe(false);
  });
});
