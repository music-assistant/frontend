import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  createRouter,
  createWebHashHistory,
  type Router,
  type RouteRecordRaw,
} from "vue-router";

const PREFIX = "/app/music_assistant";

const routes: RouteRecordRaw[] = ["/home", "/artists", "/search"].map(
  (path) => ({ path, component: {} }),
);

let ha: typeof import("./homeassistant");
let router: Router;
let postMessage: ReturnType<typeof vi.spyOn>;

function reportHARoute(path: string) {
  window.dispatchEvent(
    new MessageEvent("message", {
      source: window,
      data: {
        type: "home-assistant/properties",
        narrow: true,
        route: { prefix: PREFIX, path },
      },
    }),
  );
}

interface HAMessage {
  type: string;
  path?: string;
  options?: { replace?: boolean };
}

function haNavigations() {
  return (postMessage.mock.calls as [HAMessage][])
    .map(([message]) => message)
    .filter((message) => message.type === "home-assistant/navigate")
    .map(({ path, options }) => ({ path, replace: options?.replace }));
}

async function open(kioskMode: boolean) {
  // The history bridge lives at module level, so each test starts one afresh.
  vi.resetModules();
  ha = await import("./homeassistant");
  window.history.replaceState(null, "", "/");
  router = createRouter({
    history: ha.withHAHistory(createWebHashHistory()),
    routes,
  });
  router.afterEach((to) => ha.notifyHARouteChange(to.fullPath));
  await router.push("/home");
  ha.subscribeToHAProperties({ kioskMode, router });
  postMessage.mockClear();
  // Home Assistant opens the panel without a view of ours in its URL.
  reportHARoute("");
}

beforeEach(() => {
  postMessage = vi.spyOn(window.parent, "postMessage");
});

afterEach(() => {
  ha.unsubscribeFromHAProperties();
  vi.restoreAllMocks();
});

describe("route sync with Home Assistant", () => {
  it("puts the current view in the Home Assistant URL on the first report", async () => {
    await open(true);

    expect(haNavigations()).toEqual([
      { path: `${PREFIX}/home`, replace: true },
    ]);
  });

  it("pushes each view to Home Assistant in the full screen", async () => {
    await open(true);
    postMessage.mockClear();
    const length = window.history.length;

    await router.push("/artists");

    expect(haNavigations()).toEqual([
      { path: `${PREFIX}/artists`, replace: false },
    ]);
    expect(window.history.length).toBe(length);
    expect(router.options.history.state.back).toBe("/home");
  });

  it("follows Home Assistant back and forward in the full screen", async () => {
    await open(true);
    await router.push("/artists");
    reportHARoute("/artists");
    postMessage.mockClear();

    reportHARoute("/home");
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/home"),
    );
    expect(router.options.history.state.back).toBeNull();
    expect(router.options.history.state.forward).toBe("/artists");

    reportHARoute("/artists");
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/artists"),
    );
    expect(router.options.history.state.back).toBe("/home");
    expect(haNavigations()).toEqual([]);
  });

  it("keeps the query of a view Home Assistant returns to", async () => {
    await open(true);
    await router.push("/search?query=abba");
    reportHARoute("/search");
    reportHARoute("/home");
    await vi.waitFor(() =>
      expect(router.currentRoute.value.path).toBe("/home"),
    );

    reportHARoute("/search");

    await vi.waitFor(() =>
      expect(router.currentRoute.value.fullPath).toBe("/search?query=abba"),
    );
  });

  it("keeps its own history outside the full screen", async () => {
    await open(false);
    postMessage.mockClear();
    const length = window.history.length;

    await router.push("/artists");

    expect(haNavigations()).toEqual([
      { path: `${PREFIX}/artists`, replace: true },
    ]);
    expect(window.history.length).toBe(length + 1);
  });
});
