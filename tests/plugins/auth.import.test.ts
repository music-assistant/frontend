// @vitest-environment node

import { AuthManager, authManager } from "@/plugins/auth";
import { afterEach, describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/store", () => ({
  store: {
    currentUser: undefined,
  },
}));

describe("auth module", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("imports without browser storage", () => {
    expect(authManager.getToken()).toBeNull();
  });

  it("constructs when browser storage access is blocked", () => {
    const storageError = new DOMException("Access denied", "SecurityError");
    vi.stubGlobal("sessionStorage", { getItem: () => null });
    vi.stubGlobal("localStorage", {
      getItem: () => {
        throw storageError;
      },
    });
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);

    expect(() => new AuthManager()).not.toThrow();
    expect(warn).toHaveBeenCalledWith(
      "Unable to restore authentication token.",
      storageError,
    );
  });
});
