import { navigateInHA } from "@/plugins/homeassistant";
import type { HistoryState, RouterHistory } from "vue-router";

type NavigationCallback = Parameters<RouterHistory["listen"]>[0];
type NavigationInformation = Parameters<NavigationCallback>[2];

interface HistoryEntry {
  id: string;
  // The entry this one was opened from.
  from?: string;
  // Whether it is the first entry of the tab, with nothing behind it.
  first?: boolean;
  location: string;
  state: HistoryState;
}

// What each of Home Assistant's own history entries carries of the app's.
interface HAEntryMark {
  id: string;
  // The entry it was opened from, and the page that entry shows.
  from?: string;
  back?: string;
}

/**
 * Whether Home Assistant's app panel frames the app, so the router should let
 * Home Assistant keep its history.
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
  const initialMark = readHAMark();
  const entries: HistoryEntry[] = [
    {
      ...entryOf(initialLocation, initialMark),
      first: isFirstHAEntry(),
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

  function readHAMark(): HAEntryMark | undefined {
    return haWindow.history.state?.musicAssistant;
  }

  function isFirstHAEntry(): boolean {
    // Home Assistant marks the first entry of a tab as its root, in place of
    // the app's own mark.
    return haWindow.history.state?.root === true;
  }

  function navigateHA(replace: boolean): void {
    const { id, from, location, state } = entries[position];
    // Marks Home Assistant's entry, to tell it apart from one of the same page.
    const back = typeof state.back === "string" ? state.back : undefined;
    const musicAssistant: HAEntryMark = { id, from, back };
    navigateInHA(panelPath + location, { replace, data: { musicAssistant } });
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
    if (location === null) {
      return;
    }
    const mark = readHAMark();
    const current = entries[position];
    // The first entry of a tab is Home Assistant's own, and keeps no mark.
    const isFirst = !mark && isFirstHAEntry();
    const isLanded = (entry: HistoryEntry) =>
      mark
        ? entry.id === mark.id
        : isFirst
          ? !!entry.first
          : isSameLocation(entry.location, location);
    if (isLanded(current)) {
      return;
    }
    const index = entries.findIndex(isLanded);
    if (index !== -1) {
      move(index - position, true);
      return;
    }

    // A page from before a reload. It goes next to the one it left, so the
    // router can return there when it turns the step down.
    const entry = {
      ...entryOf(location, mark),
      first: isFirstHAEntry(),
    };
    if (current.first || mark?.from === current.id) {
      entry.state.back = current.location;
      current.state = { ...current.state, forward: location };
      entries.splice(position + 1, Infinity, entry);
      position++;
      syncFrameUrl();
      notifyListeners(current.location, 1);
    } else {
      entry.state.forward = current.location;
      current.state = { ...current.state, back: location };
      current.from = entry.id;
      entries.splice(0, position, entry);
      position = 0;
      syncFrameUrl();
      notifyListeners(current.location, -1);
    }
  }

  // Follows a page Home Assistant opens itself, such as the app's own entry
  // in its sidebar.
  function handleHANavigation(event: Event): void {
    const location = readHALocation();
    if (
      location === null ||
      // The app's own navigations are marked, and Home Assistant's are not.
      readHAMark() ||
      (event as CustomEvent<{ replace?: boolean }>).detail?.replace ||
      isSameLocation(location, currentLocation())
    ) {
      return;
    }
    const current = entries[position];
    current.state = { ...current.state, forward: location };
    const entry = entryOf(location, {
      from: current.id,
      back: current.location,
    });
    entries.splice(position + 1, Infinity, entry);
    position++;
    syncFrameUrl();
    // Marks Home Assistant's entry, to find it again when coming back to it.
    navigateHA(true);
    notifyListeners(current.location, 1);
  }

  function handlePageHide(event: PageTransitionEvent): void {
    // A page kept for going back to comes back as it was.
    if (!event.persisted) {
      stopFollowingHA();
    }
  }

  function stopFollowingHA(): void {
    haWindow.removeEventListener("popstate", handleHAPop);
    haWindow.removeEventListener("location-changed", handleHANavigation);
  }

  haWindow.addEventListener("popstate", handleHAPop);
  haWindow.addEventListener("location-changed", handleHANavigation);
  // Home Assistant outlives the frame, and would keep this document around.
  window.addEventListener("pagehide", handlePageHide);

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
      const current = entries[position];
      current.state = { ...current.state, forward: to };
      const entry = entryOf(to, { from: current.id, back: current.location });
      entry.state = {
        ...entry.state,
        position: position + 1,
        replaced: false,
        ...data,
      };
      entries.splice(position + 1, Infinity, entry);
      position++;
      syncFrameUrl();
      navigateHA(false);
    },
    replace(to, data) {
      const entry = entries[position];
      entry.location = to;
      entry.state = { ...entry.state, current: to, replaced: true, ...data };
      syncFrameUrl();
      navigateHA(true);
    },
    go(delta, triggerListeners = true) {
      // Home Assistant's history is the one to walk, and the pop it makes moves
      // the app along, unless the router moved already.
      if (!triggerListeners) {
        move(delta, false);
      }
      haWindow.history.go(delta);
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
      window.removeEventListener("pagehide", handlePageHide);
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

/**
 * A history entry, as far as its mark in Home Assistant's history tells.
 */
function entryOf(
  location: string,
  { id = newEntryId(), from, back }: Partial<HAEntryMark> = {},
): HistoryEntry {
  return {
    id,
    from,
    location,
    state: {
      back: back ?? null,
      current: location,
      forward: null,
      position: 0,
      replaced: true,
      scroll: null,
    },
  };
}

function newEntryId(): string {
  return Math.random().toString(36).slice(2);
}
