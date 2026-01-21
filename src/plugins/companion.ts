/**
 * Companion App Integration
 *
 * This module provides integration with Music Assistant Companion apps
 * (desktop, mobile, etc.). When running in a companion app, it enables
 * native features like:
 * - Discord Rich Presence (shows currently playing track)
 * - System tray with now-playing info
 * - Native Sendspin audio player (companion app handles audio playback)
 * - Future: Native notifications, media keys, etc.
 *
 * Detection: The companion app exposes a global object with an `invoke` function:
 * - Tauri apps: window.__TAURI__ (automatically set by Tauri)
 * - Other frameworks: window.__COMPANION__ (custom, must provide invoke function)
 *
 * The invoke function signature: invoke<T>(cmd: string, args?: object) => Promise<T>
 *
 * When not running in a companion app (e.g., in a browser), all functions are no-ops.
 */

import { getMediaImageUrl } from "@/helpers/utils";
import { PlaybackState, Player, PlayerSource } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ref, watch } from "vue";

/**
 * Check if running in a companion app
 * Detects either Tauri context (__TAURI__) or custom companion context (__COMPANION__)
 */
export const isCompanionApp = (): boolean => {
  if (typeof window === "undefined") return false;

  // Tauri companion app
  if ("__TAURI__" in window) return true;

  // Other companion app frameworks (e.g., Electron, React Native, etc.)
  if ("__COMPANION__" in window) return true;

  return false;
};

/**
 * Whether the app is running in companion mode (native desktop/mobile app)
 * When true, the frontend should NOT start its built-in Sendspin player
 * and may enable other companion-specific behaviors
 */
export const companionMode = ref(isCompanionApp());

// Type for the invoke function
type CompanionInvoke = <T>(
  cmd: string,
  args?: Record<string, unknown>,
) => Promise<T>;

/**
 * Get the invoke function from the companion app context
 * Returns null if not running in a companion app
 */
const getCompanionInvoke = (): CompanionInvoke | null => {
  if (typeof window === "undefined") return null;

  // Tauri companion app
  if ("__TAURI__" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const tauri = (window as any).__TAURI__;
    return tauri?.core?.invoke || tauri?.invoke || null;
  }

  // Other companion app frameworks
  if ("__COMPANION__" in window) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const companion = (window as any).__COMPANION__;
    return companion?.invoke || null;
  }

  return null;
};
/**
 * Now-playing information for the desktop app
 */
export interface NowPlaying {
  /** Whether something is currently playing */
  is_playing: boolean;
  /** Track name */
  track: string | null;
  /** Artist name */
  artist: string | null;
  /** Album name */
  album: string | null;
  /** Image URL */
  image_url: string | null;
  /** Player name */
  player_name: string | null;
  /** Player ID */
  player_id: string | null;
  /** Duration in seconds */
  duration: number | null;
  /** Elapsed time in seconds */
  elapsed: number | null;
  /** Whether play action is available */
  can_play: boolean;
  /** Whether pause action is available */
  can_pause: boolean;
  /** Whether next track action is available */
  can_next: boolean;
  /** Whether previous track action is available */
  can_previous: boolean;
}

/**
 * Get the companion app version
 */
export const getCompanionAppVersion = async (): Promise<string | null> => {
  const invoke = getCompanionInvoke();
  if (!invoke) return null;

  try {
    return await invoke<string>("get_app_version");
  } catch {
    return null;
  }
};


/**
 * Get the companion app's Sendspin player ID
 * This can be used to show a "This Device" badge in the player list
 */
export const getCompanionPlayerId = async (): Promise<string | null> => {
  const invoke = getCompanionInvoke();
  if (!invoke) return null;

  try {
    return await invoke<string | null>("get_sendspin_player_id");
  } catch {
    return null;
  }
};

/**
 * Configure the companion app's Sendspin client with the MA server URL
 * This allows the native player to connect to Sendspin
 *
 * @param serverBaseUrl - The base URL of the MA server (e.g., "http://192.168.1.100:8095")
 * @param authToken - Auth token for the MA server proxy (required)
 * @returns The player ID if the client was started, null otherwise
 */
export const configureSendspin = async (
  serverBaseUrl: string,
  authToken: string,
): Promise<string | null> => {
  const invoke = getCompanionInvoke();
  if (!invoke) return null;

  try {
    console.log(
      "[Companion] Configuring Sendspin with server URL:",
      serverBaseUrl,
    );
    const playerId = await invoke<string | null>("configure_sendspin", {
      serverBaseUrl,
      authToken,
    });
    if (playerId) {
      console.log("[Companion] Sendspin client started with ID:", playerId);
    }
    return playerId;
  } catch (error) {
    console.warn("[Companion] Failed to configure Sendspin:", error);
    return null;
  }
};

/**
 * Update the now-playing information in the desktop app
 * This updates the system tray tooltip and Discord Rich Presence
 */
const updateNowPlaying = async (nowPlaying: NowPlaying): Promise<void> => {
  const invoke = getCompanionInvoke();
  if (!invoke) return;

  try {
    await invoke("update_now_playing", { nowPlaying });
  } catch (error) {
    console.warn("[Companion] Failed to update now-playing:", error);
  }
};

/**
 * Get the active source from a player (for capabilities)
 */
const getActiveSource = (player: Player): PlayerSource | undefined => {
  if (!player.active_source || !player.source_list) return undefined;
  return player.source_list.find((source) => source.id === player.active_source);
};

/**
 * Extract now-playing info from the active player
 */
const extractNowPlaying = (player: Player | undefined): NowPlaying => {
  if (!player) {
    return {
      is_playing: false,
      track: null,
      artist: null,
      album: null,
      image_url: null,
      player_name: null,
      player_id: null,
      duration: null,
      elapsed: null,
      can_play: false,
      can_pause: false,
      can_next: false,
      can_previous: false,
    };
  }

  const media = player.current_media;
  const activeSource = getActiveSource(player);
  const isPlaying = player.playback_state === PlaybackState.PLAYING;

  // Get capabilities from active source
  const canPlayPause = activeSource?.can_play_pause ?? !!media;
  const canNextPrev = activeSource?.can_next_previous ?? false;

  // Get album art URL (convert to full URL if needed)
  let imageUrl: string | null = null;
  if (media?.image_url) {
    imageUrl = getMediaImageUrl(media.image_url);
  }

  return {
    is_playing: isPlaying,
    track: media?.title || null,
    artist: media?.artist || null,
    album: media?.album || null,
    image_url: imageUrl,
    player_name: player.name,
    player_id: player.player_id,
    duration: media?.duration || null,
    elapsed: Math.round(player.elapsed_time || 0),
    // Play is available when not playing, pause when playing (if source supports it)
    can_play: !isPlaying && canPlayPause,
    can_pause: isPlaying && canPlayPause,
    can_next: canNextPrev,
    can_previous: canNextPrev,
  };
};

// Store the unwatch function for cleanup
let unwatchNowPlaying: (() => void) | null = null;

/**
 * Start watching the active player and push updates to Tauri
 */
const startNowPlayingWatcher = (): void => {
  // Don't start if already watching
  if (unwatchNowPlaying) return;

  const invoke = getCompanionInvoke();
  if (!invoke) {
    console.warn("[Companion] No invoke function available");
    return;
  }

  // First, start the companion services (Discord RPC, etc.)
  invoke("start_desktop_services").catch((e) =>
    console.warn("[Companion] Failed to start services:", e),
  );

  // Watch for changes in track or playback state
  unwatchNowPlaying = watch(
    () => ({
      uri: store.activePlayer?.current_media?.uri,
      state: store.activePlayer?.playback_state,
      playerId: store.activePlayer?.player_id,
    }),
    (newVal, oldVal) => {
      // Skip if nothing meaningful changed
      if (
        oldVal &&
        newVal.uri === oldVal.uri &&
        newVal.state === oldVal.state &&
        newVal.playerId === oldVal.playerId
      ) {
        return;
      }

      const nowPlaying = extractNowPlaying(store.activePlayer);
      updateNowPlaying(nowPlaying);
    },
    { immediate: true },
  );
};

/**
 * Stop watching the active player queue
 */
const stopNowPlayingWatcher = (): void => {
  if (unwatchNowPlaying) {
    unwatchNowPlaying();
    unwatchNowPlaying = null;
  }
};

/**
 * Initialize companion app integration
 * Call this once the app is connected and authenticated to the MA server
 *
 * @param serverAddress - The MA server base URL (e.g., "http://192.168.1.100:8095")
 */
export const initializeCompanionIntegration = async (
  serverAddress: string,
): Promise<void> => {
  if (!isCompanionApp()) {
    return;
  }

  console.log(
    "[Companion] Companion app detected, initializing integrations...",
  );

  // Enable companion mode - this disables the frontend's built-in Sendspin player
  companionMode.value = true;
  console.log("[Companion] Companion mode enabled");

  // Configure native Sendspin player (backend will check if enabled)
  if (serverAddress) {
    const { authManager } = await import("@/plugins/auth");
    const token = authManager.getToken();
    if (token) {
      const playerId = await configureSendspin(serverAddress, token);
      // Store companion player ID so UI can show "This device" badge
      if (playerId) {
        store.companionPlayerId = playerId;
      }
    }
  }

  // Start watching now-playing and pushing to Tauri
  startNowPlayingWatcher();

  // Signal to companion app that we're ready
  // This prevents the "outdated server" warning
  const invoke = getCompanionInvoke();
  if (invoke) {
    try {
      await invoke("companion_ready");
    } catch {
      // Ignore - older companion app versions may not have this command
    }
  }

  // Log app version for debugging
  const version = await getCompanionAppVersion();
  if (version) {
    console.log("[Companion] App version:", version);
  }
};


/**
 * Clean up companion app integration
 * Call this when disconnecting from the MA server
 */
export const cleanupCompanionIntegration = (): void => {
  if (!isCompanionApp()) {
    return;
  }

  stopNowPlayingWatcher();
  companionMode.value = false;
  store.companionPlayerId = undefined;

  // Clear now-playing state
  updateNowPlaying({
    is_playing: false,
    track: null,
    artist: null,
    album: null,
    image_url: null,
    player_name: null,
    player_id: null,
    duration: null,
    elapsed: null,
    can_play: false,
    can_pause: false,
    can_next: false,
    can_previous: false,
  });
};


/**
 * Notify the companion app that the user has logged out
 * This navigates back to the server selection screen
 */
export const notifyCompanionLogout = async (): Promise<void> => {
  const invoke = getCompanionInvoke();
  if (!invoke) return;

  try {
    await invoke("navigate_to_launcher");
  } catch (error) {
    console.warn("[Companion] Failed to navigate to launcher:", error);
  }
};
