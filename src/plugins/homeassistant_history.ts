import type { HARoute } from "@/plugins/homeassistant";
import { navigateInHA } from "@/plugins/homeassistant";
import type { HistoryState, RouterHistory } from "vue-router";

type NavigationCallback = Parameters<RouterHistory["listen"]>[0];
type NavigationInformation = Parameters<NavigationCallback>[2];

interface HistoryEntry {
  location: string;
  state: HistoryState;
}

/**
 * The path of the app's panel in Home Assistant.
 *
 * The app panel opens an app at `/app/<slug>` and its own sidebar entry at
 * `/<slug>`. Worked out from the full path rather than taken from the route
 * Home Assistant reports, which older releases split one segment too far for
 * the sidebar entry.
 */
function panelPathOf(haPath: string): string {
  const [, panel, slug] = haPath.split("/");
  return panel === "app" ? `/app/${slug}` : `/${panel}`;
}

/**
 * The path of a location as Home Assistant reports it: without query or hash,
 * and encoded the way the browser keeps it.
 */
function pathOf(location: string): string {
  return new URL(location, window.location.origin).pathname;
}

/**
 * Router history for the app embedded in the Home Assistant panel.
 *
 * Home Assistant keeps the history: every navigation becomes an entry in its
 * URL, so its back button, and the one of the companion apps, walks back
 * through the app, and reloading Home Assistant opens the page the user was
 * on. Until Home Assistant reports its route, navigations stay in memory.
 */
export function createHAHistory(): RouterHistory {
  let listeners: NavigationCallback[] = [];
  const initialLocation = window.location.hash.slice(1) || "/";
  const entries: HistoryEntry[] = [
    {
      location: initialLocation,
      state: {
        back: null,
        current: initialLocation,
        forward: null,
        position: 0,
        replaced: true,
        scroll: null,
      },
    },
  ];
  let position = 0;
  // Known from the first route Home Assistant reports.
  let panelPath: string | null = null;
  let reportedPath: string | null = null;
  // Paths asked of Home Assistant that it has yet to report back.
  const pendingReports: string[] = [];
  // Where Home Assistant is, or is about to be.
  let haPath: string | null = null;
  // A page Home Assistant opened before the router listens for it.
  let restorePath: string | null = null;

  const currentLocation = () => entries[position].location;

  function syncFrameUrl(): void {
    // Keeps the page across a reload of the frame alone, without adding an
    // entry of its own to the history Home Assistant keeps.
    window.history.replaceState(
      window.history.state,
      "",
      `#${currentLocation()}`,
    );
  }

  function syncToHA(location: string, replace: boolean): void {
    if (panelPath === null || restorePath !== null) {
      return;
    }
    const path = pathOf(location);
    // Home Assistant reports only a change of path, not one of the query alone.
    if (path !== haPath) {
      pendingReports.push(path);
      haPath = path;
    }
    navigateInHA(panelPath + location, { replace });
  }

  function triggerListeners(from: string, delta: number): void {
    const info = {
      type: "pop",
      direction: delta < 0 ? "back" : delta > 0 ? "forward" : "",
      delta,
    } as NavigationInformation;
    for (const listener of listeners) {
      listener(currentLocation(), from, info);
    }
  }

  function move(delta: number, trigger: boolean): void {
    const from = currentLocation();
    position = Math.max(0, Math.min(position + delta, entries.length - 1));
    syncFrameUrl();
    if (trigger) {
      triggerListeners(from, delta);
    }
  }

  // Opens a page Home Assistant went to that is not next to the current one,
  // such as one from before a reload.
  function open(location: string): void {
    if (!listeners.length) {
      restorePath = location;
      return;
    }
    const from = currentLocation();
    entries.splice(0, entries.length, {
      location,
      state: {
        back: null,
        current: location,
        forward: null,
        position: 0,
        replaced: true,
        scroll: null,
      },
    });
    position = 0;
    syncFrameUrl();
    triggerListeners(from, 0);
  }

  function followHA(route: HARoute): void {
    const fullPath = route.prefix + route.path;
    const firstReport = panelPath === null;
    panelPath ??= panelPathOf(fullPath);
    const path = pathOf(fullPath.slice(panelPath.length) || "/");
    // Home Assistant also reports when anything but the route changes.
    if (path === reportedPath) {
      return;
    }
    reportedPath = path;

    const pending = pendingReports.indexOf(path);
    if (pending !== -1) {
      pendingReports.splice(0, pending + 1);
      return;
    }
    haPath = path;

    if (firstReport) {
      // What was navigated before is not in Home Assistant's history, so there
      // is no going back to it through there.
      const current = entries[position];
      entries.splice(0, entries.length, current);
      position = 0;
      current.state = { ...current.state, back: null, forward: null };
      if (path === "/") {
        syncToHA(currentLocation(), true);
        return;
      }
    }

    if (path === pathOf(currentLocation())) {
      return;
    }
    if (
      entries[position - 1] &&
      pathOf(entries[position - 1].location) === path
    ) {
      move(-1, true);
    } else if (
      entries[position + 1] &&
      pathOf(entries[position + 1].location) === path
    ) {
      move(1, true);
    } else {
      open(path);
    }
  }

  function handleMessage(event: MessageEvent): void {
    if (
      event.source === window.parent &&
      event.data?.type === "home-assistant/properties" &&
      event.data.route
    ) {
      followHA(event.data.route);
    }
  }

  window.addEventListener("message", handleMessage);

  const history: RouterHistory = {
    base: "",
    get location() {
      return currentLocation();
    },
    get state() {
      return entries[position].state;
    },
    createHref: (location) => `#${location}`,
    push(to, data) {
      const from = currentLocation();
      entries[position].state = { ...entries[position].state, forward: to };
      entries.splice(position + 1);
      entries.push({
        location: to,
        state: {
          back: from,
          current: to,
          forward: null,
          position: position + 1,
          replaced: false,
          scroll: null,
          ...data,
        },
      });
      position++;
      syncFrameUrl();
      syncToHA(to, false);
    },
    replace(to, data) {
      const { state } = entries[position];
      entries[position] = {
        location: to,
        state: { ...state, current: to, replaced: true, ...data },
      };
      syncFrameUrl();
      syncToHA(to, true);
    },
    go(delta, triggerListeners = true) {
      if (panelPath === null) {
        move(delta, triggerListeners);
        return;
      }
      // Home Assistant's history is the one to walk: the route it reports
      // back moves the app along, unless the router moved already.
      if (!triggerListeners) {
        move(delta, false);
        haPath = pathOf(currentLocation());
      }
      window.history.go(delta);
    },
    listen(callback) {
      listeners.push(callback);
      if (restorePath !== null) {
        const location = restorePath;
        restorePath = null;
        // Lets the router finish the navigation it is listening from first.
        queueMicrotask(() => open(location));
      }
      return () => {
        listeners = listeners.filter((listener) => listener !== callback);
      };
    },
    destroy() {
      listeners = [];
      window.removeEventListener("message", handleMessage);
    },
  };

  return history;
}
