<template>
  <VSonner position="bottom-right" />

  <!-- Remote connection screen (when in remote mode and not connected) -->
  <RemoteConnect
    v-if="showRemoteConnect"
    :can-connect-locally="canConnectLocally"
    @connected="handleRemoteConnected"
    @authenticated="handleRemoteAuthenticated"
    @switch-to-local="switchToLocalMode"
  />

  <!-- Main app (when connected) -->
  <template v-else>
    <router-view v-if="store.connected" />
    <v-progress-linear v-else indeterminate color="primary" />
  </template>

  <PlayerBrowserMediaControls
    v-if="
      webPlayer.audioSource === WebPlayerMode.CONTROLS_ONLY &&
      webPlayer.interacted == true
    "
  />
  <BuiltinPlayer
    v-if="webPlayer.tabMode === WebPlayerMode.BUILTIN && webPlayer.player_id"
    :player-id="webPlayer.player_id"
  />
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onMounted, nextTick, ref, computed } from "vue";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import RemoteConnect from "./views/RemoteConnect.vue";
import { EventType } from "./plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import { useRouter } from "vue-router";
import {
  remoteConnectionManager,
  ConnectionMode,
  RemoteConnectionState,
} from "./plugins/remote";
import type { ITransport } from "./plugins/remote/transport";

const theme = useTheme();
const router = useRouter();

// Remote connection state
const isRemoteMode = ref(false);
const remoteConnected = ref(false);
const remoteAuthenticated = ref(false);
const canConnectLocally = ref(false);

// Show remote connect screen when in remote mode and not authenticated
const showRemoteConnect = computed(() => {
  return isRemoteMode.value && !remoteAuthenticated.value;
});

const setTheme = function () {
  const themePref = localStorage.getItem("frontend.settings.theme") || "auto";
  if (themePref == "dark") {
    // forced dark mode
    theme.global.name.value = "dark";
  } else if (themePref == "light") {
    // forced light mode
    theme.global.name.value = "light";
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    // dark mode is enabled in browser
    theme.global.name.value = "dark";
  } else {
    // light mode is enabled in browser
    theme.global.name.value = "light";
  }
};

const interactedHandler = function () {
  webPlayer.setInteracted();
  window.removeEventListener("click", interactedHandler);
};

const getDeviceName = function (): string {
  // Generate a friendly device name from the user agent
  const ua = navigator.userAgent;
  let browser = "Browser";
  let os = "Unknown OS";

  // Detect browser
  if (ua.includes("Firefox/")) {
    browser = "Firefox";
  } else if (ua.includes("Edg/")) {
    browser = "Edge";
  } else if (ua.includes("Chrome/")) {
    browser = "Chrome";
  } else if (ua.includes("Safari/") && !ua.includes("Chrome/")) {
    browser = "Safari";
  }

  // Detect OS
  if (ua.includes("Windows")) {
    os = "Windows";
  } else if (ua.includes("Mac OS X")) {
    os = "macOS";
  } else if (ua.includes("Linux")) {
    os = "Linux";
  } else if (ua.includes("Android")) {
    os = "Android";
  } else if (
    ua.includes("iOS") ||
    ua.includes("iPhone") ||
    ua.includes("iPad")
  ) {
    os = "iOS";
  }

  return `Music Assistant Web (${browser} on ${os})`;
};

/**
 * Check if we're running in remote mode (hosted on a public domain)
 * Remote mode is when the frontend is hosted separately from the backend
 */
const detectRemoteMode = (): boolean => {
  const hostname = window.location.hostname;

  // Check if URL has remote parameter (accepts "true", "1", or just present)
  const urlParams = new URLSearchParams(window.location.search);
  const remoteParam = urlParams.get("remote");
  if (remoteParam === "true" || remoteParam === "1") {
    console.log("[App] Remote mode enabled via URL parameter");
    return true;
  }

  // Check if stored mode is remote
  const storedMode = localStorage.getItem("ma_remote_mode");
  if (storedMode === ConnectionMode.REMOTE) {
    console.log("[App] Remote mode enabled via stored preference");
    return true;
  }

  // Known remote hosting domains (only check if not explicitly set via URL)
  const remoteHostnames = [
    "app.music-assistant.io",
    "music-assistant.github.io",
  ];

  // Check if hostname matches known remote domains
  if (remoteHostnames.some((h) => hostname.includes(h))) {
    console.log("[App] Remote mode enabled via hostname match");
    return true;
  }

  return false;
};

/**
 * Handle WebRTC transport connected (but not yet authenticated)
 */
const handleRemoteConnected = async (transport: ITransport) => {
  console.log("[App] Remote transport connected, initializing API");
  remoteConnected.value = true;

  try {
    // Initialize the API with the WebRTC transport
    await api.initializeWithTransport(transport);
    console.log("[App] API initialized with transport");
  } catch (error) {
    console.error("[App] Failed to initialize API with transport:", error);
  }
};

/**
 * Handle remote authentication (username/password)
 */
const handleRemoteAuthenticated = async (credentials: {
  username: string;
  password: string;
}) => {
  console.log("[App] Authenticating with credentials");

  try {
    // Login with credentials
    const result = await api.loginWithCredentials(
      credentials.username,
      credentials.password,
      getDeviceName()
    );

    console.log("[App] Login successful:", result);

    // Update auth manager
    const { authManager } = await import("@/plugins/auth");
    authManager.setToken(result.token);
    if (result.user) {
      authManager.setCurrentUser(result.user);
      store.currentUser = result.user;
    }

    // Mark as authenticated
    remoteAuthenticated.value = true;
    store.isAuthenticated = true;

    // Update remote connection manager
    remoteConnectionManager.setAuthenticated(
      api.serverInfo.value?.server_id || undefined
    );

    // Continue with normal app initialization
    await initializeApp();
  } catch (error) {
    console.error("[App] Authentication failed:", error);
    throw error;
  }
};

/**
 * Switch from remote mode to local mode
 */
const switchToLocalMode = () => {
  isRemoteMode.value = false;
  remoteConnectionManager.setMode(ConnectionMode.LOCAL);
  remoteConnectionManager.clearStoredRemoteId();

  // Remove remote parameter from URL before reloading
  const urlParams = new URLSearchParams(window.location.search);
  urlParams.delete("remote");
  const cleanUrl =
    window.location.pathname +
    (urlParams.toString() ? "?" + urlParams.toString() : "") +
    window.location.hash;

  // Reload to start fresh in local mode
  window.location.href = cleanUrl;
};

/**
 * Initialize the app after connection is established
 */
const initializeApp = async () => {
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";

  // Subscribe to CONNECTED event to handle server info
  api.subscribe(EventType.CONNECTED, async () => {
    const serverInfo = api.serverInfo.value;
    if (!serverInfo) {
      console.error("No server info received");
      return;
    }

    store.serverInfo = serverInfo;

    // For remote connections, onboarding is not applicable
    // (server should already be set up)

    store.isAuthenticated = true;

    // Fetch library counts
    store.libraryArtistsCount = await api.getLibraryArtistsCount();
    store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
    store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
    store.libraryRadiosCount = await api.getLibraryRadiosCount();
    store.libraryTracksCount = await api.getLibraryTracksCount();
    store.connected = true;

    // Enable builtin player if available
    if (allowBuiltinPlayer && api.getProvider("builtin_player")) {
      webPlayer.setMode(WebPlayerMode.BUILTIN);
    } else {
      webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
    }
  });

  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
  });
};

/**
 * Initialize local connection (original flow)
 */
const initializeLocalConnection = async (serverAddress: string) => {
  // Set base URL for auth manager
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);

  // Check if we're returning from login with a code
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get("code");
  const onboardParam = urlParams.get("onboard");
  let tokenFromLogin = false;

  if (onboardParam === "true") {
    store.isOnboarding = true;
  }

  if (codeParam) {
    console.debug("Code received from login, storing and cleaning URL");
    authManager.setToken(codeParam);
    tokenFromLogin = true;

    urlParams.delete("code");
    const cleanUrl =
      window.location.pathname +
      (urlParams.toString() ? "?" + urlParams.toString() : "") +
      window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
  }

  const authToken = authManager.getToken();
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";

  store.connected = false;

  // Subscribe to CONNECTED event
  api.subscribe(EventType.CONNECTED, async () => {
    const serverInfo = api.serverInfo.value;
    if (!serverInfo) {
      console.error("No server info received from WebSocket");
      return;
    }

    store.serverInfo = serverInfo;

    // Check if onboarding is needed
    if (!serverInfo.onboard_done) {
      console.info("Onboarding not done, redirecting to server setup");
      const returnUrl = encodeURIComponent(window.location.href);
      const deviceName = encodeURIComponent(getDeviceName());
      const baseUrl = serverAddress.endsWith("/")
        ? serverAddress.slice(0, -1)
        : serverAddress;
      window.location.href = `${baseUrl}/setup?return_url=${returnUrl}&device_name=${deviceName}`;
      return;
    }

    store.isAuthenticated = true;

    // Store current user
    let currentUser = authManager.getCurrentUser();
    if (!currentUser) {
      const storedUser = localStorage.getItem("ma_current_user");
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
          if (currentUser) {
            authManager.setCurrentUser(currentUser);
          }
        } catch (e) {
          console.error("Failed to parse stored user", e);
        }
      }
    }
    if (currentUser) {
      store.currentUser = currentUser;
    }

    // Fetch library counts
    store.libraryArtistsCount = await api.getLibraryArtistsCount();
    store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
    store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
    store.libraryRadiosCount = await api.getLibraryRadiosCount();
    store.libraryTracksCount = await api.getLibraryTracksCount();
    store.connected = true;

    // Handle onboarding redirect
    if (store.isOnboarding) {
      console.debug("Redirecting to providers page for onboarding");
      await nextTick();
      router.replace("/settings/providers");
    }

    // Enable builtin player
    if (allowBuiltinPlayer && api.getProvider("builtin_player")) {
      webPlayer.setMode(WebPlayerMode.BUILTIN);
    } else {
      webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
    }
  });

  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
  });

  // Initialize API connection
  api.initialize(serverAddress, authToken, tokenFromLogin);
  webPlayer.setBaseUrl(serverAddress);
};

onMounted(async () => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  // Cache language settings
  const langPref = localStorage.getItem("frontend.settings.language") || "auto";
  if (langPref !== "auto") {
    i18n.global.locale.value = langPref;
  }

  const forceMobileLayout =
    localStorage.getItem("frontend.settings.force_mobile_layout") == "true";
  store.forceMobileLayout = forceMobileLayout;

  // Set color theme
  setTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);

  // Detect if we're in remote mode
  isRemoteMode.value = detectRemoteMode();

  if (isRemoteMode.value) {
    console.log("[App] Running in remote mode");

    // Check if we can also connect locally (for hybrid setups)
    canConnectLocally.value = process.env.NODE_ENV === "development";

    // In remote mode, the RemoteConnect component will handle the connection
    // The app will wait for handleRemoteConnected and handleRemoteAuthenticated
  } else {
    console.log("[App] Running in local mode");

    // Initialize server address for local connection
    let serverAddress = "";
    if (process.env.NODE_ENV === "development") {
      serverAddress = localStorage.getItem("mass_debug_address") || "";
      if (!serverAddress) {
        serverAddress =
          prompt(
            "Enter location of the Music Assistant server",
            window.location.origin.replace("3000", "8095")
          ) || "";
        localStorage.setItem("mass_debug_address", serverAddress);
      }
    } else {
      const loc = window.location;
      serverAddress = loc.origin + loc.pathname;
    }

    await initializeLocalConnection(serverAddress);
  }

  // Handle audio interaction requirement
  window.addEventListener("click", interactedHandler);
});
</script>
