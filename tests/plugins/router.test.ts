import { routes } from "@/plugins/router";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({
  api: { state: { value: "initialized" } },
  ConnectionState: { INITIALIZED: "initialized" },
}));

vi.mock("@/plugins/auth", () => ({
  authManager: { isGuestAccessSession: () => false },
}));

vi.mock("@/plugins/homeassistant", () => ({
  notifyHARouteChange: vi.fn(),
}));

vi.mock("@/plugins/store", () => ({
  store: {
    currentUser: undefined,
    isIngressSession: false,
    isOnboarding: false,
  },
}));

describe("guest routes", () => {
  it("redirects the old Music Quiz player link through the resolver", () => {
    const legacyRoute = routes.find(
      (route) => route.path === "/music-quiz/play",
    );

    expect(legacyRoute?.redirect).toBe("/guest");
  });

  it("keeps Party and Music Quiz under the unified guest layout", () => {
    const guestRoute = routes.find((route) => route.path === "/guest");

    expect(guestRoute?.children?.map((route) => route.path)).toEqual([
      "",
      "party",
      "quiz",
    ]);
  });

  it("disables media controls on participant routes", () => {
    const guestRoute = routes.find((route) => route.path === "/guest");
    const participantRoutes = guestRoute?.children?.filter(
      (route) => route.path === "party" || route.path === "quiz",
    );

    expect(
      participantRoutes?.every(
        (route) => route.meta?.disableMediaSession === true,
      ),
    ).toBe(true);
  });
});
