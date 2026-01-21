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

interface HAState {
  isSubscribed: boolean;
  kioskModeEnabled: boolean;
  routeSyncEnabled: boolean;
  properties: HAProperties;
}

const state = reactive<HAState>({
  isSubscribed: false,
  kioskModeEnabled: false,
  routeSyncEnabled: false,
  properties: {
    narrow: false,
    route: null,
  },
});

let messageHandler: ((event: MessageEvent) => void) | null = null;
let routerInstance: Router | null = null;
let isNavigatingFromHA = false;

function handleMessage(event: MessageEvent) {
  if (event.data?.type === "home-assistant/properties") {
    const oldRoute = state.properties.route?.path;
    state.properties.narrow = event.data.narrow ?? false;
    state.properties.route = event.data.route ?? null;

    console.log("[HA Debug] Received properties:", event.data);
    console.log("[HA Debug] Route from HA:", state.properties.route);

    if (
      state.routeSyncEnabled &&
      routerInstance &&
      state.properties.route?.path
    ) {
      const haRoutePath = state.properties.route.path;
      const currentMARoute = routerInstance.currentRoute.value.fullPath;

      console.log("[HA Debug] HA route path:", haRoutePath);
      console.log("[HA Debug] Current MA route:", currentMARoute);

      if (haRoutePath !== currentMARoute && oldRoute !== haRoutePath) {
        console.log("[HA Debug] Navigating MA to:", haRoutePath);
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
 * Optionally enables kiosk mode which hides HA's toolbar.
 *
 * @param options.kioskMode - If true, requests HA to hide its toolbar
 * @param options.router - Vue router instance for route synchronization
 */
export function subscribeToHAProperties(
  options: { kioskMode?: boolean; router?: Router } = {},
): void {
  if (state.isSubscribed) {
    console.warn("[HA Integration] Already subscribed to HA properties");
    return;
  }

  if (options.router) {
    routerInstance = options.router;
    state.routeSyncEnabled = true;
    console.log("[HA Debug] Route sync enabled with router");
  }

  messageHandler = handleMessage;
  window.addEventListener("message", messageHandler);

  window.parent.postMessage(
    {
      type: "home-assistant/subscribe-properties",
      kioskMode: options.kioskMode ?? false,
    },
    "*",
  );

  state.isSubscribed = true;
  state.kioskModeEnabled = options.kioskMode ?? false;

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
  routerInstance = null;

  console.debug("[HA Integration] Unsubscribed from HA properties");
}

let storedRouter: Router | null = null;

const KIOSK_PREF_KEY = "ha.kioskModeEnabled";

export function getKioskModePreference(): boolean {
  const stored = localStorage.getItem(KIOSK_PREF_KEY);

  return stored === null ? true : stored === "true";
}

function saveKioskModePreference(enabled: boolean): void {
  localStorage.setItem(KIOSK_PREF_KEY, String(enabled));
}

/**
 * Show the Home Assistant menu by disabling kiosk mode.
 * This unsubscribes from properties (which disables kiosk mode).
 */
export function showHAMenu(): void {
  console.log("[HA Debug] showHAMenu called");

  if (routerInstance) {
    storedRouter = routerInstance;
  }

  saveKioskModePreference(false);

  unsubscribeFromHAProperties();
}

/**
 * Hide the Home Assistant menu by enabling kiosk mode.
 * This re-subscribes with kioskMode: true.
 */
export function hideHAMenu(): void {
  console.log("[HA Debug] hideHAMenu called");

  saveKioskModePreference(true);

  subscribeToHAProperties({
    kioskMode: true,
    router: storedRouter || undefined,
  });
}

/**
 * Toggle the Home Assistant menu visibility.
 * When visible (kiosk mode off), hides it.
 * When hidden (kiosk mode on), shows it.
 */
export function toggleHAMenuVisibility(): void {
  console.log(
    "[HA Debug] toggleHAMenuVisibility - current kioskMode:",
    state.kioskModeEnabled,
  );

  if (state.kioskModeEnabled) {
    showHAMenu();
  } else {
    hideHAMenu();
  }
}

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
    console.log("[HA Debug] Skipping notify - navigation from HA");
    return;
  }

  console.log("[HA Debug] Notifying HA of route change:", path);

  navigateInHA(path, { replace: true });
}

/**
 * Toggle the Home Assistant sidebar menu.
 * Useful when in kiosk mode to let users access HA navigation.
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
