import { createHAHistory } from "@/plugins/homeassistant_history";
import { defineComponent } from "vue";
import { createRouter, type Router, type RouterHistory } from "vue-router";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const PANEL = "/d5369777_music_assistant";

const View = defineComponent({ render: () => null });
const routes = ["/", "/home", "/artists", "/artists/:id", "/search"].map(
  (path) => ({ path, component: View }),
);

const settle = () => new Promise((resolve) => setTimeout(resolve));

/**
 * The Home Assistant around the frame: it keeps a history of its own URLs and
 * reports its route whenever it changes. `legacySplit` reports the route the
 * way releases before the sidebar entry fix did.
 */
function fakeHomeAssistant(initialPath: string, legacySplit = false) {
  const entries = [initialPath];
  let index = 0;

  const report = () => {
    const fullPath = entries[index];
    const divider = fullPath.indexOf("/", legacySplit ? PANEL.length + 1 : 1);
    const route =
      divider === -1
        ? { prefix: fullPath, path: "" }
        : { prefix: fullPath.slice(0, divider), path: fullPath.slice(divider) };
    window.dispatchEvent(
      new MessageEvent("message", {
        data: { type: "home-assistant/properties", narrow: false, route },
        source: window.parent,
      }),
    );
  };

  const postMessage = vi
    .spyOn(window.parent, "postMessage")
    .mockImplementation(
      (message: {
        type: string;
        path: string;
        options: { replace?: boolean };
      }) => {
        if (message.type !== "home-assistant/navigate") return;
        // Home Assistant only reports the pathname, so drop the query like it does.
        if (message.options.replace) {
          entries[index] = message.path;
        } else {
          entries.splice(index + 1, entries.length, message.path);
          index++;
        }
        setTimeout(report);
      },
    );

  const go = vi.spyOn(window.history, "go").mockImplementation((delta = 0) => {
    index = Math.max(0, Math.min(index + delta, entries.length - 1));
    setTimeout(report);
  });

  return {
    entries: () => entries.map((path) => path.split("?")[0]),
    get path() {
      return entries[index];
    },
    back: () => window.history.go(-1),
    report,
    postMessage,
    restore() {
      postMessage.mockRestore();
      go.mockRestore();
    },
  };
}

describe("Home Assistant router history", () => {
  let history: RouterHistory;
  let router: Router;
  let ha: ReturnType<typeof fakeHomeAssistant>;

  async function start(haPath: string, legacySplit = false) {
    ha = fakeHomeAssistant(haPath, legacySplit);
    history = createHAHistory();
    router = createRouter({ history, routes });
    await router.push(history.location);
    // The first route arrives once the app subscribes.
    ha.report();
    await settle();
  }

  beforeEach(() => {
    window.history.replaceState(null, "", "#/home");
  });

  afterEach(() => {
    history.destroy();
    ha.restore();
  });

  it("gives Home Assistant an entry for every page opened", async () => {
    await start(PANEL);

    await router.push("/artists");
    await router.push("/artists/1");
    await settle();

    expect(ha.entries()).toEqual([
      `${PANEL}/home`,
      `${PANEL}/artists`,
      `${PANEL}/artists/1`,
    ]);
  });

  it("follows Home Assistant's back button through the app", async () => {
    await start(PANEL);
    await router.push("/artists");
    await router.push("/artists/1");
    await settle();

    ha.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists");
    // What views tell a return by, e.g. to restore their scroll position.
    expect(history.state.forward).toBe("/artists/1");
  });

  it("walks Home Assistant's history from the app's own back button", async () => {
    await start(PANEL);
    await router.push("/search?query=abba");
    await router.push("/artists/1");
    await settle();

    router.back();
    await settle();

    expect(ha.path).toBe(`${PANEL}/search?query=abba`);
    expect(router.currentRoute.value.fullPath).toBe("/search?query=abba");
  });

  it("keeps a replaced page out of Home Assistant's history", async () => {
    await start(PANEL);
    await router.push("/artists");
    await router.replace("/search");
    await settle();

    expect(ha.entries()).toEqual([`${PANEL}/home`, `${PANEL}/search`]);
  });

  it("opens the page Home Assistant is on", async () => {
    await start(`${PANEL}/artists/1`);
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/artists/1");
    expect(ha.entries()).toEqual([`${PANEL}/artists/1`]);
  });

  it("follows the route older Home Assistant releases report", async () => {
    await start(`${PANEL}/artists/1`, true);
    await settle();
    await router.push("/search");
    await settle();

    ha.back();
    await settle();

    expect(ha.entries()).toEqual([`${PANEL}/artists/1`, `${PANEL}/search`]);
    expect(router.currentRoute.value.fullPath).toBe("/artists/1");
  });

  it("follows the app panel Home Assistant opens any app in", async () => {
    await start("/app/d5369777_music_assistant");
    await router.push("/artists");
    await settle();

    expect(ha.entries()).toEqual([
      "/app/d5369777_music_assistant/home",
      "/app/d5369777_music_assistant/artists",
    ]);
  });

  it("has no way back past the page Home Assistant opened it on", async () => {
    await start(PANEL);

    expect(history.state.back).toBeNull();
  });
});

describe("Home Assistant router history before Home Assistant reports", () => {
  it("keeps the history in memory", async () => {
    window.history.replaceState(null, "", "#/home");
    const postMessage = vi
      .spyOn(window.parent, "postMessage")
      .mockImplementation(() => {});
    const history = createHAHistory();
    const router = createRouter({ history, routes });
    await router.push(history.location);

    await router.push("/artists");
    router.back();
    await settle();

    expect(router.currentRoute.value.fullPath).toBe("/home");
    expect(postMessage).not.toHaveBeenCalled();
    history.destroy();
    postMessage.mockRestore();
  });
});
