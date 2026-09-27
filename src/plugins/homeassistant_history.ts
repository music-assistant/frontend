import { navigateInHA } from "@/plugins/homeassistant";
import type { HistoryState, RouterHistory } from "vue-router";

type NavigationCallback = Parameters<RouterHistory["listen"]>[0];
type NavigationInformation = Parameters<NavigationCallback>[2];

interface HistoryEntry {
  location: string;
  state: HistoryState;
}

/**
 * Whether the app runs in the Home Assistant app panel, whose history
 * `createHAHistory` keeps it in.
 */
export function isInHAAppPanel(): boolean {
  // The frame is served from Home Assistant's own origin, which the app panel
  // relies on as well, so the element framing it can be looked at.
  const root = window.frameElement?.getRootNode();
  return (root as ShadowRoot | undefined)?.host?.localName === "ha-panel-app";
}

/**
 * Router history kept by the Home Assistant app panel around the app.
 *
 * Every navigation becomes an entry in Home Assistant's URL, so its back
 * button, and the one of the companion apps, walks back through the app, and
 * reloading Home Assistant opens the page the user was on.
 */
export function createHAHistory(): RouterHistory {
  const haWindow = window.parent;
  const panelPath = panelPathOf(haWindow.location.pathname);
  const initialLocation =
    window.location.hash.slice(1) || readHALocation() || "/";
  let listeners: NavigationCallback[] = [];
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

  const currentLocation = () => entries[position].location;

  function readHALocation(): string | null {
    const { pathname, search } = haWindow.location;
    // Anything else is a page of Home Assistant itself, left for another panel.
    if (pathname !== panelPath && !pathname.startsWith(`${panelPath}/`)) {
      return null;
    }
    return (pathname.slice(panelPath.length) || "/") + search;
  }

  function syncFrameUrl(): void {
    // Keeps the page across a reload of the frame alone, without adding an
    // entry of its own to the history Home Assistant keeps.
    window.history.replaceState(
      window.history.state,
      "",
      `#${currentLocation()}`,
    );
  }

  function notifyListeners(from: string, delta: number): void {
    const info = {
      type: "pop",
      direction: delta < 0 ? "back" : delta > 0 ? "forward" : "",
      delta,
    } as NavigationInformation;
    for (const listener of listeners) {
      listener(currentLocation(), from, info);
    }
  }

  function move(delta: number, notify: boolean): void {
    const from = currentLocation();
    position = Math.max(0, Math.min(position + delta, entries.length - 1));
    syncFrameUrl();
    if (notify) {
      notifyListeners(from, delta);
    }
  }

  // Follows Home Assistant through its history, which steps through entries
  // added here, or lands on one from before a reload.
  function handleHAPop(): void {
    const location = readHALocation();
    if (location === null || isSameLocation(location, currentLocation())) {
      return;
    }
    const isAt = (index: number) =>
      !!entries[index] && isSameLocation(entries[index].location, location);
    if (isAt(position - 1)) {
      move(-1, true);
      return;
    }
    if (isAt(position + 1)) {
      move(1, true);
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
    notifyListeners(from, 0);
  }

  function stopFollowingHA(): void {
    haWindow.removeEventListener("popstate", handleHAPop);
  }

  haWindow.addEventListener("popstate", handleHAPop);
  // Home Assistant outlives the frame, and would keep this document around.
  window.addEventListener("pagehide", stopFollowingHA);

  return {
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
      navigateInHA(panelPath + to);
    },
    replace(to, data) {
      const { state } = entries[position];
      entries[position] = {
        location: to,
        state: { ...state, current: to, replaced: true, ...data },
      };
      syncFrameUrl();
      navigateInHA(panelPath + to, { replace: true });
    },
    go(delta, triggerListeners = true) {
      // Home Assistant's history is the one to walk, and the pop it makes moves
      // the app along, unless the router moved already.
      if (!triggerListeners) {
        move(delta, false);
      }
      window.history.go(delta);
    },
    listen(callback) {
      listeners.push(callback);
      return () => {
        listeners = listeners.filter((listener) => listener !== callback);
      };
    },
    destroy() {
      listeners = [];
      stopFollowingHA();
      window.removeEventListener("pagehide", stopFollowingHA);
    },
  };
}

/**
 * The path of the app's panel in Home Assistant.
 *
 * The app panel opens an app at `/app/<slug>` and its own sidebar entry at
 * `/<slug>`.
 */
function panelPathOf(haPath: string): string {
  const [, panel, slug] = haPath.split("/");
  return panel === "app" ? `/app/${slug}` : `/${panel}`;
}

/**
 * Whether two locations are the same page, whichever way their URLs are
 * encoded.
 */
function isSameLocation(a: string, b: string): boolean {
  const url = (location: string) => {
    const { pathname, search } = new URL(location, window.location.origin);
    return pathname + search;
  };
  return url(a) === url(b);
}
