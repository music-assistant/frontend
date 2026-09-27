import {
  HA_KIOSK_MODE,
  readDeviceSetting,
  subscribeToDeviceSetting,
} from "@/helpers/device_settings";
import { reactive, readonly } from "vue";
import type { HistoryState, Router, RouterHistory } from "vue-router";

export interface HARoute {
  path: string;
  prefix: string;
}

export interface HAProperties {
  narrow: boolean;
  route: HARoute | null;
}

export interface HASafeAreaInsets {
  top: string;
  right: string;
  bottom: string;
  left: string;
}

interface HAState {
  isSubscribed: boolean;
  kioskModeEnabled: boolean;
  routeSyncEnabled: boolean;
  safeAreaEnabled: boolean;
  properties: HAProperties;
}

const state = reactive<HAState>({
  isSubscribed: false,
  kioskModeEnabled: false,
  routeSyncEnabled: false,
  safeAreaEnabled: false,
  properties: {
    narrow: false,
    route: null,
  },
});

const SAFE_AREA_EDGES = ["top", "right", "bottom", "left"] as const;

let messageHandler: ((event: MessageEvent) => void) | null = null;
let routerInstance: Router | null = null;
let isNavigatingFromHA = false;
let reportedInsets: Partial<HASafeAreaInsets> | null = null;

// The views behind the history entries Home Assistant keeps for us while it
// owns the history, and the one it is showing now.
let haEntries: string[] = [];
let haIndex = -1;
let haPushPending = false;

/**
 * Whether Home Assistant keeps the history entries for our views.
 *
 * With the full screen the app looks like part of Home Assistant, so its views
 * have to be steps back in Home Assistant too. Otherwise the entries our own
 * frame adds stay the steps back, and Home Assistant only follows our URL.
 */
function haOwnsHistory(): boolean {
  return (
    state.routeSyncEnabled &&
    state.kioskModeEnabled &&
    !!state.properties.route?.prefix
  );
}

/**
 * Hand the history entries to Home Assistant while it owns the history.
 *
 * Our frame then moves in place, and Home Assistant adds the entry. The
 * Android app only steps back through entries of the Home Assistant page, and
 * an entry in both places would take two steps back for every view. The
 * router still reads which views are back and forward from the state of its
 * own history, so that state comes from the entries Home Assistant keeps.
 */
export function withHAHistory(history: RouterHistory): RouterHistory {
  const { push, replace } = history;

  function replaceWithEntries(to: string, data?: HistoryState) {
    replace(to, {
      ...data,
      back: haEntries[haIndex - 1] ?? null,
      forward: haEntries[haIndex + 1] ?? null,
    });
  }

  history.push = (to, data) => {
    if (!haOwnsHistory()) {
      push(to, data);
      return;
    }
    if (haIndex < 0) {
      haEntries = [history.location];
      haIndex = 0;
    }

    if (isNavigatingFromHA && haEntries[haIndex - 1] === to) {
      haIndex--;
    } else if (isNavigatingFromHA && haEntries[haIndex + 1] === to) {
      haIndex++;
    } else if (isNavigatingFromHA) {
      // An entry we did not add, such as one from before a reload.
      haEntries[haIndex] = to;
    } else {
      haEntries.splice(haIndex + 1, Infinity, to);
      haIndex++;
      haPushPending = true;
    }
    replaceWithEntries(to, data);
  };

  history.replace = (to, data) => {
    if (!haOwnsHistory() || haIndex < 0) {
      replace(to, data);
      return;
    }
    haEntries[haIndex] = to;
    replaceWithEntries(to, data);
  };

  return history;
}

/**
 * The view to show for a route Home Assistant moved to.
 *
 * Home Assistant leaves the query out of the route it reports, so a step back
 * or forward takes the view it had from the entry we keep.
 */
function viewForHARoute(path: string): string {
  const neighbours = [haEntries[haIndex - 1], haEntries[haIndex + 1]];
  return neighbours.find((entry) => entry?.split("?")[0] === path) ?? path;
}

/**
 * The part of the reported safe area Music Assistant is left to cover.
 *
 * While Home Assistant is narrow it puts a header of its own above the frame,
 * and that header already takes the top inset, so claiming it again would only
 * push the app further down the screen. Kiosk mode drops that header, and hands
 * the top inset back to us along with it.
 */
function ownedInsets(
  insets: Partial<HASafeAreaInsets>,
): Partial<HASafeAreaInsets> {
  const headerShown = state.properties.narrow && !state.kioskModeEnabled;

  return headerShown ? { ...insets, top: "" } : insets;
}

/**
 * Apply the safe area Home Assistant reports to the device inset tokens.
 *
 * Edges Home Assistant reports nothing for are handed back to the stylesheet,
 * as is the whole safe area while Home Assistant is padding the frame itself.
 */
function applySafeAreaInsets(): void {
  const insets =
    state.safeAreaEnabled && reportedInsets ? ownedInsets(reportedInsets) : {};

  for (const edge of SAFE_AREA_EDGES) {
    const property = `--device-inset-${edge}`;
    // Setting these inline is what lifts them above the zeroed tokens an
    // embedded layout gets, which stay right for every host that reports none.
    if (insets[edge]) {
      document.documentElement.style.setProperty(property, insets[edge]);
    } else {
      document.documentElement.style.removeProperty(property);
    }
  }
}

function handleMessage(event: MessageEvent) {
  // Home Assistant posts to the frame it embeds us in, so anything from another
  // sender is not it.
  if (event.source !== window.parent) {
    return;
  }

  if (event.data?.type === "home-assistant/properties") {
    const isFirstReport = state.properties.route === null;
    const oldRoute = state.properties.route?.path;
    state.properties.narrow = event.data.narrow ?? false;
    state.properties.route = event.data.route ?? null;

    // Home Assistant reports the insets whether or not we asked for them, and
    // only stops padding the iframe itself once we did. Keep the last ones it
    // sent: a later update may leave them out while still moving the header.
    if (event.data.safeAreaInsets) {
      reportedInsets = event.data.safeAreaInsets;
    }
    applySafeAreaInsets();

    if (state.routeSyncEnabled && routerInstance && isFirstReport) {
      // Home Assistant opens the frame on the panel itself, so its URL starts
      // out without the view we show.
      notifyHARouteChange(routerInstance.currentRoute.value.fullPath);
    } else if (
      state.routeSyncEnabled &&
      routerInstance &&
      state.properties.route?.path
    ) {
      const haRoutePath = state.properties.route.path;
      const currentMARoute = routerInstance.currentRoute.value.path;

      if (
        oldRoute &&
        haRoutePath !== currentMARoute &&
        oldRoute !== haRoutePath
      ) {
        isNavigatingFromHA = true;
        routerInstance.push(viewForHARoute(haRoutePath)).finally(() => {
          isNavigatingFromHA = false;
        });
      }
    }
  }
}

/**
 * Subscribe to Home Assistant properties updates.
 *
 * @param options.kioskMode - If true, asks Home Assistant to drop the header
 *   and menu it draws around the frame and leave the app the whole screen
 * @param options.handleSafeArea - If true, takes the safe area padding HA puts
 *   around the ingress iframe over into the device inset tokens
 * @param options.router - Vue router instance for route synchronization
 */
export function subscribeToHAProperties(
  options: {
    kioskMode?: boolean;
    handleSafeArea?: boolean;
    router?: Router;
  } = {},
): void {
  if (state.isSubscribed) {
    console.warn("[HA Integration] Already subscribed to HA properties");
    return;
  }

  if (options.router) {
    routerInstance = options.router;
    state.routeSyncEnabled = true;
  }

  messageHandler = handleMessage;
  window.addEventListener("message", messageHandler);

  window.parent.postMessage(
    {
      type: "home-assistant/subscribe-properties",
      kioskMode: options.kioskMode ?? false,
      handleSafeArea: options.handleSafeArea ?? false,
    },
    "*",
  );

  state.isSubscribed = true;
  state.kioskModeEnabled = options.kioskMode ?? false;
  state.safeAreaEnabled = options.handleSafeArea ?? false;

  console.debug(
    "[HA Integration] Subscribed to HA properties",
    options.kioskMode ? "(kiosk mode enabled)" : "",
  );
}

/**
 * Unsubscribe from Home Assistant properties updates.
 * Also disables kiosk mode if it was enabled.
 */
export function unsubscribeFromHAProperties(): void {
  if (!state.isSubscribed) {
    return;
  }

  if (messageHandler) {
    window.removeEventListener("message", messageHandler);
    messageHandler = null;
  }

  window.parent.postMessage(
    {
      type: "home-assistant/unsubscribe-properties",
    },
    "*",
  );

  state.isSubscribed = false;
  state.kioskModeEnabled = false;
  state.routeSyncEnabled = false;
  state.safeAreaEnabled = false;
  routerInstance = null;
  reportedInsets = null;
  haEntries = [];
  haIndex = -1;
  haPushPending = false;

  // Home Assistant pads the iframe again the moment we unsubscribe, so hand the
  // safe area back rather than reserving it twice.
  applySafeAreaInsets();

  console.debug("[HA Integration] Unsubscribed from HA properties");
}

/**
 * Whether Home Assistant should hand its whole screen estate to Music Assistant.
 *
 * On unless it was turned off for this device in the frontend settings.
 */
export function getKioskModePreference(): boolean {
  return readDeviceSetting(HA_KIOSK_MODE) !== "false";
}

/**
 * Re-subscribe so a changed kiosk mode preference reaches Home Assistant.
 *
 * A subscription can only ever turn kiosk mode on, so leaving it takes an
 * unsubscribe. Everything else the subscription carries has to come along:
 * dropping the safe area handover would leave Home Assistant padding the frame
 * for the rest of the visit.
 */
function applyKioskModePreference(): void {
  const kioskMode = getKioskModePreference();

  if (!state.isSubscribed || kioskMode === state.kioskModeEnabled) {
    return;
  }

  const handleSafeArea = state.safeAreaEnabled;
  const router = routerInstance ?? undefined;

  unsubscribeFromHAProperties();
  subscribeToHAProperties({ kioskMode, handleSafeArea, router });
}

// Home Assistant keeps kiosk mode up across a reload of this frame, so the
// preference has to be acted on where it is written rather than on the next
// startup, which would find Home Assistant already in kiosk mode and leave it
// there.
subscribeToDeviceSetting(HA_KIOSK_MODE, applyKioskModePreference);

/**
 * Notify Home Assistant of a route change in Music Assistant.
 * This keeps the HA URL in sync with the MA route, and adds the history entry
 * for a new view while Home Assistant owns the history.
 *
 * @param path - The MA route path (e.g., "/home", "/artists/spotify/123")
 */
export function notifyHARouteChange(path: string): void {
  const replace = !haPushPending;
  haPushPending = false;

  if (!state.isSubscribed || !state.routeSyncEnabled) {
    return;
  }

  if (isNavigatingFromHA) {
    return;
  }

  const prefix = state.properties.route?.prefix;
  if (!prefix) {
    return;
  }

  const fullPath = prefix + path;
  navigateInHA(fullPath, { replace });
}

/**
 * Open or close the Home Assistant sidebar over the app.
 *
 * Home Assistant opens it as an overlay while kiosk mode is on, which is what
 * makes this the way back out of a full screen Music Assistant.
 */
export function toggleHAMenu(): void {
  window.parent.postMessage(
    {
      type: "home-assistant/toggle-menu",
    },
    "*",
  );
}

/**
 * Navigate to a path within Home Assistant.
 *
 * @param path - The HA path to navigate to (e.g., "/lovelace", "/config")
 * @param options - Navigation options (replace history, etc.)
 */
export function navigateInHA(
  path: string,
  options: { replace?: boolean } = {},
): void {
  window.parent.postMessage(
    {
      type: "home-assistant/navigate",
      path,
      options,
    },
    "*",
  );
}

export const haState = readonly(state);
