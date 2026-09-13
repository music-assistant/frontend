import { describe, expect, it, vi } from "vitest";
import { roleLabel } from "./users";

vi.mock("@/plugins/i18n", () => ({
  // the real one hands back the key it was given when it knows none
  $t: (key: string) => (key === "auth.admin_role" ? "Administrator" : key),
}));

describe("roleLabel", () => {
  it("gives a role the name it goes by here", () => {
    expect(roleLabel("admin")).toBe("Administrator");
  });

  it("falls back on the role itself when there is no name for it", () => {
    // a server can carry a role this frontend has never heard of; the role id
    // reads better than the translation key nobody found
    expect(roleLabel("dj")).toBe("dj");
  });
});
