import { reactive, readonly } from "vue";

export interface HAProperties {
  narrow: boolean;
  route: {
    path: string;
    prefix: string;
  } | null;
}

interface HAState {
  isSubscribed: boolean;
  kioskModeEnabled: boolean;
  properties: HAProperties;
}

const state = reactive<HAState>({
  isSubscribed: false,
  kioskModeEnabled: false,
  properties: {
    narrow: false,
    route: null,
  },
});

let messageHandler: ((event: MessageEvent) => void) | null = null;

function handleMessage(event: MessageEvent) {
  if (event.data?.type === "home-assistant/properties") {
    state.properties.narrow = event.data.narrow ?? false;
    state.properties.route = event.data.route ?? null;
  }
}

/**
 * Subscribe to Home Assistant properties updates.
 * Optionally enables kiosk mode which hides HA's toolbar.
 *
 * @param options.kioskMode - If true, requests HA to hide its toolbar
 * @returns Unsubscribe function
 */
export function subscribeToHAProperties(
  options: { kioskMode?: boolean } = {},
): () => void {
  if (state.isSubscribed) {
    console.warn("[HA Integration] Already subscribed to HA properties");
    return unsubscribeFromHAProperties;
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

  return unsubscribeFromHAProperties;
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

  console.debug("[HA Integration] Unsubscribed from HA properties");
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

export default {
  subscribeToHAProperties,
  unsubscribeFromHAProperties,
  toggleHAMenu,
  navigateInHA,
  state: haState,
};
