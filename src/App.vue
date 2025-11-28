<template>
  <VSonner position="bottom-right" />

  <!-- Login screen (when not authenticated) -->
  <Login
    v-if="showLogin"
    @connected="handleRemoteConnected"
    @authenticated="handleRemoteAuthenticated"
    @local-connect="handleLocalConnect"
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
import Login from "./views/Login.vue";
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

// Show login screen when not authenticated
const showLogin = computed(() => {
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
 * Handle authentication (username/password or token)
 */
const handleRemoteAuthenticated = async (credentials: {
  username?: string;
  password?: string;
  token?: string;
  user?: any;
}) => {
  console.log("[App] Handling authentication");

  try {
    const { authManager } = await import("@/plugins/auth");
    let user = credentials.user;

    if (credentials.token && credentials.user) {
      // Already authenticated with token (auto-login flow)
      console.log("[App] Using pre-authenticated token");
      authManager.setToken(credentials.token);
      authManager.setCurrentUser(credentials.user);
    } else if (credentials.username && credentials.password) {
      // Login with credentials
      console.log("[App] Logging in with credentials");
      const result = await api.loginWithCredentials(
        credentials.username,
        credentials.password,
        getDeviceName()
      );
      console.log("[App] Login successful:", result);
      authManager.setToken(result.token);
      user = result.user;
      if (user) {
        authManager.setCurrentUser(user);
      }
    } else {
      throw new Error("Invalid authentication credentials");
    }

    if (user) {
      store.currentUser = user;
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
 * Handle local connection from login screen
 * Just establishes the WebSocket connection - authentication handled by handleRemoteAuthenticated
 */
const handleLocalConnect = async (serverAddress: string) => {
  console.log("[App] Connecting to local server:", serverAddress);

  // Set base URL for auth manager
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);

  // Pass the HTTP base URL to api.initialize - it will build the WebSocket URL
  await api.initialize(serverAddress);
  console.log("[App] WebSocket connected, waiting for authentication");
};

/**
 * Initialize the app after connection is established
 */
const initializeApp = async () => {
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";

  // Helper function to complete initialization
  const completeInitialization = async () => {
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
  };

  // Subscribe to CONNECTED event for future reconnections
  api.subscribe(EventType.CONNECTED, completeInitialization);

  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
  });

  // For remote connections, server info is already available (CONNECTED already fired)
  // So we need to run initialization immediately
  if (api.serverInfo.value) {
    await completeInitialization();
  }
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

  // Always show Login screen - it handles both local and remote connections
  // Login.vue has smart auto-connect that will:
  // 1. Try stored server address + token (auto-login)
  // 2. Try current host if frontend is hosted on MA server
  // 3. Show connection options if nothing else works
  isRemoteMode.value = true;
  console.log("[App] Showing login screen");

  // Handle audio interaction requirement
  window.addEventListener("click", interactedHandler);
});
</script>
