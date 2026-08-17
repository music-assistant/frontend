import {
  HA_KIOSK_MODE,
  readDeviceSetting,
  subscribeToDeviceSetting,
} from "@/helpers/device_settings";
import { reactive, readonly } from "vue";
import type { Router } from "vue-router";

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

    if (
      state.routeSyncEnabled &&
      routerInstance &&
      state.properties.route?.path
    ) {
      const haRoutePath = state.properties.route.path;
      const currentMARoute = routerInstance.currentRoute.value.fullPath;

      if (
        oldRoute &&
        haRoutePath !== currentMARoute &&
        oldRoute !== haRoutePath
      ) {
        isNavigatingFromHA = true;
        routerInstance.push(haRoutePath).finally(() => {
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
 * This keeps the HA URL in sync with the MA route.
 *
 * @param path - The MA route path (e.g., "/home", "/artists/spotify/123")
 */
export function notifyHARouteChange(path: string): void {
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
  navigateInHA(fullPath, { replace: true });
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
