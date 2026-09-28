import {
  createHAHistory,
  isInHAAppPanel,
} from "@/plugins/homeassistant_history";
import { defineComponent } from "vue";
import { createRouter, type Router, type RouterHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

const PANEL = "/d5369777_music_assistant";

const View = defineComponent({ render: () => null });
const routes = [
  "/",
  "/home",
  "/artists",
  "/artists/:id",
  "/browse",
  "/search",
].map((path) => ({ path, component: View }));

const settle = () => new Promise((resolve) => setTimeout(resolve));

/**
 * The Home Assistant window around the frame: it keeps a history of its own
 * URLs and their state the way Home Assistant's `navigate` does, and pops when
 * the history is walked. `earlierPaths` are entries from before the app was
 * opened, the first of them the tab's own.
 */
function fakeHomeAssistant(initialPath: string, earlierPaths: string[] = []) {
  interface Entry {
    path: string;
    state: Record<string, unknown>;
  }
  const entries: Entry[] = [...earlierPaths, initialPath].map(
    (path, i, paths) =>
      i
        ? { path, state: { from: pathnameOf(paths[i - 1]) } }
        : { path, state: { root: true } },
  );
  let index = earlierPaths.length;
  const url = () => new URL(entries[index].path, "http://homeassistant.local");

  const haWindow = Object.assign(new EventTarget(), {
    history: {
      get state() {
        return entries[index].state;
      },
      go(delta = 0) {
        const target = Math.max(0, Math.min(index + delta, entries.length - 1));
        if (target === index) return;
        index = target;
        setTimeout(() => haWindow.dispatchEvent(new Event("popstate")));
      },
    },
    location: {
      get pathname() {
        return url().pathname;
      },
      get search() {
        return url().search;
      },
    },
    postMessage(message: {
      type: string;
      path: string;
      options: { replace?: boolean; data?: Record<string, unknown> };
    }) {
      if (message.type !== "home-assistant/navigate") return;
      // Messages reach Home Assistant a task later.
      setTimeout(() => navigate(message.path, message.options));
    },
  });

  function navigate(
    path: string,
    { replace, data }: { replace?: boolean; data?: Record<string, unknown> },
  ) {
    if (replace) {
      // A replaced entry keeps where it came from, and the tab's first entry
      // stays marked as such instead of taking the data.
      const { root, from } = entries[index].state;
      const state = root ? { root } : data;
      entries[index] = { path, state: { ...state, from } };
    } else {
      const from = pathnameOf(entries[index].path);
      entries.splice(index + 1, entries.length, {
        path,
        state: { ...data, from },
      });
      index++;
    }
    haWindow.dispatchEvent(
      Object.assign(new Event("location-changed"), { detail: { replace } }),
    );
  }

  const parent = Object.getOwnPropertyDescriptor(window, "parent");
  Object.defineProperty(window, "parent", {
    value: haWindow,
    configurable: true,
  });

  return {
    entries: () => entries.map((entry) => entry.path),
    get path() {
      return entries[index].path;
    },
    back: () => haWindow.history.go(-1),
    forward: () => haWindow.history.go(1),
    // Home Assistant opening a page of its own accord.
    open: (path: string) => navigate(path, {}),
    restore() {
      if (parent) {
        Object.defineProperty(window, "parent", parent);
      } else {
        delete (window as { parent?: Window }).parent;
      }
    },
  };
}

function pathnameOf(path: string): string {
  return new URL(path, "http://homeassistant.local").pathname;
}

describe("Home Assistant router history", () => {
  let history: RouterHistory;
  let router: Router;
  let ha: ReturnType<typeof fakeHomeAssistant>;

  // Opens a page and lets Home Assistant follow.
  async function push(to: string) {
    await router.push(to);
    await settle();
  }

  async function replace(to: string) {
    await router.replace(to);
    await settle();
  }

  async function start(haPath: string, earlierPaths: string[] = []) {
    ha = fakeHomeAssistant(haPath, earlierPaths);
    await openApp();
  }

  async function openApp() {
    history = createHAHistory();
    router = createRouter({ history, routes });
    await push(history.location);
  }

  // Home Assistant reloads, and opens the app afresh in a new frame.
  async function reloadHA() {
    history.destroy();
    window.history.replaceState(null, "", "#");
    await openApp();
  }

  beforeEach(() => {
    window.history.replaceState(null, "", "#");
  });

  afterEach(() => {
    history.destroy();
    ha.restore();
  });

  it("gives Home Assistant an entry for every page opened", async () => {
    await start(`${PANEL}/home`);

    await push("/artists");
    await push("/search?query=abba");

    expect(ha.entries()).toEqual([
      `${PANEL}/home`,
      `${PANEL}/artists`,
      `${PANEL}/search?query=abba`,
    ]);
  });

  it("follows Home Assistant's back button through the app", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    await push("/artists/1");

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    // What views tell a return by, e.g. to restore their scroll position.
    expect(history.state.forward).toBe("/artists/1");
  });

  it("goes back to the parent of a browsed folder", async () => {
    await start(`${PANEL}/home`);
    await push("/browse?path=music");
    await push("/browse?path=music%2Fabba");

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/browse?path=music");
  });

  it("walks Home Assistant's history from the app's own back button", async () => {
    await start(`${PANEL}/home`);
    await push("/search?query=abba");
    await push("/artists/1");

    router.back();
    await settle();

    expect(ha.path).toBe(`${PANEL}/search?query=abba`);
    expect(router.currentRoute.value.fullPath).toBe("/search?query=abba");
  });

  it("keeps a replaced page out of Home Assistant's history", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    await replace("/search");

    expect(ha.entries()).toEqual([`${PANEL}/home`, `${PANEL}/search`]);
  });

  it("takes Home Assistant back along when a guard keeps the page", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    router.beforeEach((to) => to.path !== "/home");

    ha.back();
    await settle();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    expect(ha.path).toBe(`${PANEL}/artists`);
  });

  it("opens the page Home Assistant is on", async () => {
    await start(`${PANEL}/search?query=abba`);

    expect(router.currentRoute.value.fullPath).toBe("/search?query=abba");
    expect(ha.entries()).toEqual([`${PANEL}/search?query=abba`]);
  });

  it("opens the page the frame was on when only the frame reloads", async () => {
    window.history.replaceState(null, "", "#/artists/1");

    await start(`${PANEL}/home`);

    expect(router.currentRoute.value.fullPath).toBe("/artists/1");
    expect(ha.path).toBe(`${PANEL}/artists/1`);
  });

  it("follows Home Assistant back to a page from before a reload", async () => {
    // Home Assistant's history reaches further back than the app's.
    await start(`${PANEL}/home`, [`${PANEL}/artists/1`]);

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists/1");
    expect(history.state.back).toBeNull();
  });

  it("goes back through browsed folders from before a reload", async () => {
    await start(`${PANEL}/home`);
    await push("/browse?path=music");
    await push("/browse?path=music%2Fabba");
    await push("/browse?path=music%2Fabba%2Fgold");
    await reloadHA();

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe(
      "/browse?path=music%2Fabba",
    );
    expect(history.state.forward).toBe("/browse?path=music%2Fabba%2Fgold");
  });

  it("goes back from the app's own back button after a reload", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    await push("/artists/1");
    await reloadHA();

    expect(history.state.back).toBe("/artists");
    router.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    expect(history.state.back).toBe("/home");
  });

  it("goes forward again to a page from before a reload", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    await push("/artists/1");
    ha.back();
    await settle();
    await reloadHA();

    ha.forward();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists/1");
    expect(history.state.back).toBe("/artists");
  });

  it("goes forward from the tab's first page after a reload", async () => {
    // The tab opened on the app itself.
    await start(`${PANEL}/home`);
    await push("/artists");
    ha.back();
    await settle();
    await reloadHA();

    ha.forward();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    expect(history.state.back).toBe("/home");
  });

  it("goes back to the tab's first page when a later one took its place", async () => {
    // The tab opened on the app itself.
    await start(`${PANEL}/home`);
    await push("/artists");
    await replace("/home");

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
    expect(history.state.back).toBeNull();
  });

  it("stays on the page when a guard turns down one from before a reload", async () => {
    await start(`${PANEL}/home`, [`${PANEL}/artists/1`]);
    router.beforeEach((to) => to.path !== "/artists/1");

    ha.back();
    await settle();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
    expect(ha.path).toBe(`${PANEL}/home`);
  });

  it("steps forward onto a page that is also the one behind", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");
    await push("/home");
    ha.back();
    await settle();

    ha.forward();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
    expect(history.state.back).toBe("/artists");
  });

  it("leaves the router alone when Home Assistant goes to another panel", async () => {
    await start(`${PANEL}/home`, ["/lovelace/0"]);

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
  });

  it("stops following Home Assistant once the frame goes away", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");

    window.dispatchEvent(new Event("pagehide"));
    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
  });

  it("keeps following Home Assistant when the page is kept to come back to", async () => {
    await start(`${PANEL}/home`);
    await push("/artists");

    window.dispatchEvent(
      Object.assign(new Event("pagehide"), { persisted: true }),
    );
    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
  });

  it("follows a page Home Assistant opens itself", async () => {
    await start(`${PANEL}/home`);
    await push("/artists/1");

    ha.open(`${PANEL}/artists`);
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    expect(history.state.back).toBe("/artists/1");
  });

  it("comes back to a page Home Assistant opened itself", async () => {
    await start(`${PANEL}/home`);
    await push("/artists/1");
    ha.open(`${PANEL}/artists`);
    await settle();
    ha.back();
    await settle();

    ha.forward();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    expect(history.state.back).toBe("/artists/1");
  });

  it("keeps up with pages opened faster than Home Assistant follows", async () => {
    await start(`${PANEL}/home`);

    const opened: string[] = [];
    router.afterEach((to) => {
      opened.push(to.fullPath);
    });

    // Both are opened before Home Assistant, a message away, follows the first.
    await router.push("/search");
    await router.push("/artists");
    await settle();

    expect(opened).toEqual(["/search", "/artists"]);
    expect(ha.entries()).toEqual([
      `${PANEL}/home`,
      `${PANEL}/search`,
      `${PANEL}/artists`,
    ]);
  });

  it("opens an app at the path of the app panel", async () => {
    await start("/app/d5369777_music_assistant");
    await push("/artists");

    expect(ha.entries()).toEqual([
      "/app/d5369777_music_assistant/",
      "/app/d5369777_music_assistant/artists",
    ]);
  });

  it("has no way back past the page Home Assistant opened it on", async () => {
    await start(`${PANEL}/home`);

    expect(history.state.back).toBeNull();
  });
});

describe("Home Assistant app panel", () => {
  const frameElement = Object.getOwnPropertyDescriptor(window, "frameElement");

  afterEach(() => {
    if (frameElement) {
      Object.defineProperty(window, "frameElement", frameElement);
    } else {
      delete (window as { frameElement?: Element | null }).frameElement;
    }
  });

  function frameIn(hostName: string) {
    const host = document.createElement(hostName);
    const frame = document.createElement("iframe");
    host.attachShadow({ mode: "open" }).appendChild(frame);
    Object.defineProperty(window, "frameElement", {
      value: frame,
      configurable: true,
    });
  }

  it("is where the app panel frames the app", () => {
    frameIn("ha-panel-app");

    expect(isInHAAppPanel()).toBe(true);
  });

  it("is not a dashboard card framing the app", () => {
    frameIn("hui-iframe-card");

    expect(isInHAAppPanel()).toBe(false);
  });

  it("is not a page of its own", () => {
    expect(isInHAAppPanel()).toBe(false);
  });
});
