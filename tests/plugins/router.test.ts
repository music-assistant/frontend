import { DASHBOARD_VIEWER_PATH_STORAGE_KEY } from "@/helpers/guest_session";
import { backFromMediaDetails } from "@/helpers/navigation";
import { ConnectionState } from "@/plugins/api";
import { routes } from "@/plugins/router";
import type {
  NavigationGuardNext,
  NavigationGuardWithThis,
  RouteLocationNormalizedLoaded,
  RouteRecordRaw,
  Router,
  RouterOptions,
} from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  apiState: { value: "initialized" },
  globalGuards: [] as NavigationGuardWithThis<undefined>[],
  isDashboardViewer: vi.fn(() => false),
  isGuestAccessSession: vi.fn(() => false),
  router: undefined as Router | undefined,
  store: {
    currentUser: undefined as { role: string; username: string } | undefined,
    enabledPlugins: new Set<string>(),
    frameless: false,
  },
  toastError: vi.fn(),
}));

vi.mock("@/plugins/api", async () => {
  // The guards watch api.state, so the mock has to carry a real ref: writes to
  // a plain { value } would never reach the watcher.
  const { ref } = await vi.importActual<typeof import("vue")>("vue");
  mocks.apiState = ref(mocks.apiState.value);
  return {
    api: { state: mocks.apiState },
    ConnectionState: {
      AUTHENTICATED: "authenticated",
      INITIALIZED: "initialized",
    },
  };
});

vi.mock("@/plugins/auth", () => ({
  authManager: {
    isDashboardViewer: mocks.isDashboardViewer,
    isGuestAccessSession: mocks.isGuestAccessSession,
  },
}));

vi.mock("@/plugins/homeassistant", () => ({
  notifyHARouteChange: vi.fn(),
}));

vi.mock("@/plugins/i18n", () => ({
  $t: (key: string) => key,
}));

vi.mock("@/plugins/store", () => ({
  store: mocks.store,
}));

vi.mock("vue-sonner", () => ({
  toast: { error: mocks.toastError },
}));

vi.mock("vue-router", async () => {
  const actual =
    await vi.importActual<typeof import("vue-router")>("vue-router");
  return {
    ...actual,
    // Neither the router instance nor its guards can be read back off the
    // module, so keep both while the router module builds them.
    createRouter: (options: RouterOptions) => {
      const router = actual.createRouter(options);
      const addGuard = router.beforeEach.bind(router);
      router.beforeEach = (guard) => {
        mocks.globalGuards.push(guard);
        return addGuard(guard);
      };
      mocks.router = router;
      return router;
    },
  };
});

const partyGuard = beforeEnterGuard("party");
const aiRadioGuard = beforeEnterGuard("ai-radio");
const globalGuard = globalNavigationGuard();

beforeEach(() => {
  vi.clearAllMocks();
  mocks.apiState.value = ConnectionState.INITIALIZED;
  mocks.isDashboardViewer.mockReturnValue(false);
  mocks.isGuestAccessSession.mockReturnValue(false);
  mocks.store.currentUser = undefined;
  mocks.store.enabledPlugins = new Set<string>();
  mocks.store.frameless = false;
  sessionStorage.clear();
});

afterEach(() => {
  vi.useRealTimers();
});

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

describe("music quiz dashboard route", () => {
  it("is a top-level kiosk route in the music-quiz chunk", () => {
    const dashboardRoute = routes.find(
      (route) => route.path === "/music-quiz/dashboard",
    );

    expect(dashboardRoute).toBeDefined();
    expect(dashboardRoute?.children?.map((route) => route.name)).toEqual([
      "music-quiz-dashboard",
    ]);
  });

  it("resolves without the app chrome routes' guards", () => {
    expect(resolveRoute("/music-quiz/dashboard").name).toBe(
      "music-quiz-dashboard",
    );
  });
});

describe("party dashboard route", () => {
  // the layout reads this to hand the dashboard its container whole, so the
  // flag has to reach it through the route the layout is mounted by
  it("asks the layout for a container it can fill", () => {
    const dashboardRoute = routes
      .find((route) => route.path === "/party")
      ?.children?.find((route) => route.name === "party");

    expect(dashboardRoute?.meta?.partyView).toBe(true);
  });
});

describe("party dashboard guard", () => {
  it("redirects to Discover when the party plugin is disabled", async () => {
    await expect(
      invokeGuard(partyGuard, resolveRoute("/party")),
    ).resolves.toEqual({ name: "discover" });
  });

  it("allows the party dashboard when the plugin is enabled", async () => {
    mocks.store.enabledPlugins = new Set(["party"]);

    await expect(
      invokeGuard(partyGuard, resolveRoute("/party")),
    ).resolves.toBeUndefined();
  });

  it("lets a dashboard viewer through without a plugin list of its own", async () => {
    mocks.isDashboardViewer.mockReturnValue(true);

    await expect(
      invokeGuard(partyGuard, resolveRoute("/party")),
    ).resolves.toBeUndefined();
  });

  it("checks the plugin only once the server connection is ready", async () => {
    vi.useFakeTimers();
    mocks.apiState.value = ConnectionState.AUTHENTICATED;
    const pending = trackGuard(invokeGuard(partyGuard, resolveRoute("/party")));

    // This wait has no deadline of its own, so the guard is still pending here.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pending.isSettled()).toBe(false);

    // The plugin list lands with the connection: a guard that checked it too
    // early would have redirected already.
    mocks.store.enabledPlugins = new Set(["party"]);
    mocks.apiState.value = ConnectionState.INITIALIZED;

    await expect(pending.result).resolves.toBeUndefined();
  });
});

describe("AI Radio guard", () => {
  it("redirects to Discover with a toast when the plugin is disabled", async () => {
    await expect(
      invokeGuard(aiRadioGuard, resolveRoute("/ai-radio")),
    ).resolves.toEqual({ name: "discover" });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "providers.ai_radio.toast.unavailable",
    );
  });

  it("allows AI Radio when the plugin is enabled", async () => {
    mocks.store.enabledPlugins = new Set(["ai_radio"]);

    await expect(
      invokeGuard(aiRadioGuard, resolveRoute("/ai-radio")),
    ).resolves.toBeUndefined();
    expect(mocks.toastError).not.toHaveBeenCalled();
  });

  it("drops the fallback timeout once the server connection is ready", async () => {
    vi.useFakeTimers();
    mocks.apiState.value = ConnectionState.AUTHENTICATED;
    const pending = trackGuard(
      invokeGuard(aiRadioGuard, resolveRoute("/ai-radio")),
    );

    await vi.advanceTimersByTimeAsync(9999);
    expect(pending.isSettled()).toBe(false);

    mocks.store.enabledPlugins = new Set(["ai_radio"]);
    mocks.apiState.value = ConnectionState.INITIALIZED;
    // Let the state watcher run and the guard resume, without reaching the
    // fallback deadline one millisecond away.
    await vi.advanceTimersByTimeAsync(0);

    expect(pending.isSettled()).toBe(true);
    await expect(pending.result).resolves.toBeUndefined();
    expect(vi.getTimerCount()).toBe(0);
  });

  it("stops waiting for the server connection after ten seconds", async () => {
    vi.useFakeTimers();
    mocks.apiState.value = ConnectionState.AUTHENTICATED;
    const pending = trackGuard(
      invokeGuard(aiRadioGuard, resolveRoute("/ai-radio")),
    );

    await vi.advanceTimersByTimeAsync(9999);
    expect(pending.isSettled()).toBe(false);

    await vi.advanceTimersByTimeAsync(1);

    await expect(pending.result).resolves.toEqual({ name: "discover" });
    expect(mocks.toastError).toHaveBeenCalledWith(
      "providers.ai_radio.toast.unavailable",
    );
  });
});

describe("global navigation guard", () => {
  it("sends a guest session back to the guest entry", async () => {
    mocks.isGuestAccessSession.mockReturnValue(true);

    await expect(
      invokeGuard(globalGuard, resolveRoute("/settings")),
    ).resolves.toBe("/guest");
  });

  it("leaves a guest session on the routes it is allowed to open", async () => {
    mocks.isGuestAccessSession.mockReturnValue(true);

    await expect(
      invokeGuard(globalGuard, resolveRoute("/guest/party")),
    ).resolves.toBeUndefined();
  });

  it("pins a dashboard viewer to the route it opened and drops the app chrome", async () => {
    mocks.isDashboardViewer.mockReturnValue(true);
    sessionStorage.setItem(
      DASHBOARD_VIEWER_PATH_STORAGE_KEY,
      "/now-playing?player=kitchen",
    );

    await expect(
      invokeGuard(globalGuard, resolveRoute("/discover")),
    ).resolves.toBe("/now-playing?player=kitchen");
    expect(mocks.store.frameless).toBe(true);
  });

  it("keeps a dashboard viewer on its pinned route, query string included", async () => {
    mocks.isDashboardViewer.mockReturnValue(true);
    sessionStorage.setItem(
      DASHBOARD_VIEWER_PATH_STORAGE_KEY,
      "/now-playing?player=kitchen",
    );

    await expect(
      invokeGuard(globalGuard, resolveRoute("/now-playing?player=kitchen")),
    ).resolves.toBeUndefined();
    expect(mocks.store.frameless).toBe(true);
  });

  it("keeps a dashboard viewer on the pinned Music Quiz dashboard", async () => {
    mocks.isDashboardViewer.mockReturnValue(true);
    sessionStorage.setItem(
      DASHBOARD_VIEWER_PATH_STORAGE_KEY,
      "/music-quiz/dashboard",
    );

    await expect(
      invokeGuard(globalGuard, resolveRoute("/music-quiz/dashboard")),
    ).resolves.toBeUndefined();
    await expect(
      invokeGuard(globalGuard, resolveRoute("/music-quiz")),
    ).resolves.toBe("/music-quiz/dashboard");
    expect(mocks.store.frameless).toBe(true);
  });

  it("leaves a dashboard viewer without a pinned route where it is", async () => {
    mocks.isDashboardViewer.mockReturnValue(true);

    await expect(
      invokeGuard(globalGuard, resolveRoute("/party")),
    ).resolves.toBeUndefined();
    expect(mocks.store.frameless).toBe(true);
  });

  it("redirects a non-admin away from the system settings", async () => {
    mocks.store.currentUser = { role: "user", username: "listener" };

    await expect(
      invokeGuard(globalGuard, resolveRoute("/settings/system")),
    ).resolves.toEqual({ name: "discover" });
  });

  it("redirects the system settings when nobody is signed in", async () => {
    await expect(
      invokeGuard(globalGuard, resolveRoute("/settings/system")),
    ).resolves.toEqual({ name: "discover" });
  });

  it("redirects a non-admin when a parent route carries the requirement", async () => {
    mocks.store.currentUser = { role: "user", username: "listener" };
    const to = resolveRoute("/settings/frontend");
    // The requirement counts on every matched record, not just the leaf the
    // user opened, so mark the outermost one.
    to.matched = to.matched.map((record, index) =>
      index === 0 ? { ...record, meta: { requiresAdmin: true } } : record,
    );

    await expect(invokeGuard(globalGuard, to)).resolves.toEqual({
      name: "discover",
    });
  });

  it("lets an admin into the system settings", async () => {
    mocks.store.currentUser = { role: "admin", username: "owner" };

    await expect(
      invokeGuard(globalGuard, resolveRoute("/settings/system")),
    ).resolves.toBeUndefined();
  });

  it("lets a non-admin open the player options", async () => {
    mocks.store.currentUser = { role: "user", username: "listener" };

    await expect(
      invokeGuard(
        globalGuard,
        resolveRoute("/settings/editplayer/player-1/options"),
      ),
    ).resolves.toBeUndefined();
  });

  it("reads the current user only once the server connection is ready", async () => {
    vi.useFakeTimers();
    mocks.apiState.value = ConnectionState.AUTHENTICATED;
    const pending = trackGuard(
      invokeGuard(globalGuard, resolveRoute("/settings/system")),
    );

    // This wait has no deadline of its own, so the guard is still pending here.
    await vi.advanceTimersByTimeAsync(10_000);
    expect(pending.isSettled()).toBe(false);

    // The user lands with the connection: a guard that read it too early would
    // have redirected already.
    mocks.store.currentUser = { role: "admin", username: "owner" };
    mocks.apiState.value = ConnectionState.INITIALIZED;

    await expect(pending.result).resolves.toBeUndefined();
  });

  it("does not wait for the server connection on routes without an admin requirement", async () => {
    vi.useFakeTimers();
    mocks.apiState.value = ConnectionState.AUTHENTICATED;
    const pending = trackGuard(
      invokeGuard(globalGuard, resolveRoute("/discover")),
    );

    await vi.advanceTimersByTimeAsync(10_000);

    expect(pending.isSettled()).toBe(true);
    await expect(pending.result).resolves.toBeUndefined();
  });
});

describe("media details back button", () => {
  // A details view opened directly has no history to return to, so the back
  // button goes up to the listing above it instead. Both ends come out of the
  // route table here, so a details route added without a target fails rather
  // than quietly landing on discover.
  const detailRoutes = mediaDetailRoutes(routes);

  it("finds the media details routes to check", () => {
    // guards the discovery below against silently matching nothing
    expect(detailRoutes.length).toBeGreaterThanOrEqual(9);
  });

  it.each(detailRoutes)(
    "goes up from $name to $listing",
    ({ name, listing }) => {
      const push = vi.fn<(to: { name: string }) => void>();

      backFromMediaDetails({
        back: vi.fn(),
        push,
        currentRoute: { value: { name } },
        options: { history: { state: { back: null } } },
      } as unknown as Router);

      expect(push).toHaveBeenCalledWith({ name: listing });
    },
  );
});

/**
 * Build a navigation target for a guard.
 *
 * The path runs through the app's own route table, so the guard sees the same
 * matched records and meta it gets in the running app.
 */
function resolveRoute(fullPath: string): RouteLocationNormalizedLoaded {
  if (!mocks.router) {
    throw new Error("The router module did not create a router");
  }
  return mocks.router.resolve(fullPath) as RouteLocationNormalizedLoaded;
}

/**
 * Run a guard against a navigation and hand back its result.
 */
function invokeGuard(
  guard: NavigationGuardWithThis<undefined>,
  to: RouteLocationNormalizedLoaded,
  from: RouteLocationNormalizedLoaded = resolveRoute("/discover"),
) {
  const next = (() => {}) as NavigationGuardNext;
  return Promise.resolve(guard.call(undefined, to, from, next));
}

/**
 * Wrap a guard result so a test can tell whether the guard is still waiting.
 */
function trackGuard<T>(result: Promise<T>) {
  let settled = false;
  return {
    isSettled: () => settled,
    result: result.then((value) => {
      settled = true;
      return value;
    }),
  };
}

function beforeEnterGuard(name: string): NavigationGuardWithThis<undefined> {
  const guard = findRouteRecord(name, routes)?.beforeEnter;
  if (typeof guard !== "function") {
    throw new Error(`Route "${name}" has no single beforeEnter guard`);
  }
  return guard;
}

/**
 * Every media details route paired with the listing it sits under.
 *
 * A details route is a provider-scoped child of a library section, and that
 * section's index route is the listing above it.
 */
function mediaDetailRoutes(
  records: RouteRecordRaw[],
): { name: string; listing: string }[] {
  const found: { name: string; listing: string }[] = [];
  for (const record of records) {
    const children = "children" in record ? record.children : undefined;
    if (!children) continue;

    const listing = children.find((child) => child.path === "")?.name;
    if (typeof listing === "string") {
      for (const child of children) {
        if (
          child.path.startsWith(":provider/") &&
          typeof child.name === "string"
        )
          found.push({ name: child.name, listing });
      }
    }
    found.push(...mediaDetailRoutes(children));
  }
  return found;
}

function findRouteRecord(
  name: string,
  records: RouteRecordRaw[],
): RouteRecordRaw | undefined {
  for (const record of records) {
    if (record.name === name) return record;
    const children = "children" in record ? record.children : undefined;
    const match = children && findRouteRecord(name, children);
    if (match) return match;
  }
  return undefined;
}

function globalNavigationGuard(): NavigationGuardWithThis<undefined> {
  const [guard, ...extraGuards] = mocks.globalGuards;
  if (!guard || extraGuards.length) {
    throw new Error(
      `Expected exactly one global navigation guard, found ${mocks.globalGuards.length}`,
    );
  }
  return guard;
}
