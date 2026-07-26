// @vitest-environment node

import { authManager } from "@/plugins/auth";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({
  store: {
    currentUser: undefined,
  },
}));

describe("auth module", () => {
  it("imports without browser storage", () => {
    expect(authManager.getToken()).toBeNull();
  });
});
