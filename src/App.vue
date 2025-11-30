<template>
  <VSonner position="bottom-right" />

  <!-- Login screen (when not authenticated) -->
  <Login
    v-if="showLogin"
    ref="loginComponent"
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
import { onMounted, ref, computed } from "vue";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import Login from "./views/Login.vue";
import { EventType } from "./plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import { remoteConnectionManager } from "./plugins/remote";
import type { ITransport } from "./plugins/remote/transport";
import { useRouter } from "vue-router";

const theme = useTheme();
const router = useRouter();

// Connection state
const isConnected = ref(false);
const isAuthenticated = ref(false);
const loginComponent = ref<InstanceType<typeof Login> | null>(null);

// Show login screen when not authenticated
const showLogin = computed(() => !isAuthenticated.value);

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
  isConnected.value = true;

  try {
    // Initialize the API with the WebRTC transport
    await api.initialize(transport);
  } catch (error) {
    console.error("[App] Failed to initialize API with transport:", error);
  }
};

/**
 * Handle authentication (username/password, token, or ingress)
 */
const handleRemoteAuthenticated = async (credentials: {
  username?: string;
  password?: string;
  token?: string;
  user?: any;
}) => {
  try {
    const { authManager } = await import("@/plugins/auth");
    let user = credentials.user;

    if (credentials.user && !credentials.token && !credentials.username) {
      // Ingress mode: user is already authenticated by the server
      // No token or credentials needed
      console.log(
        "[App] Ingress authentication - user auto-authenticated by server",
      );
      authManager.setCurrentUser(credentials.user);
    } else if (credentials.token && credentials.user) {
      // Already authenticated with token (auto-login flow)
      authManager.setToken(credentials.token);
      authManager.setCurrentUser(credentials.user);
    } else if (credentials.username && credentials.password) {
      // Login with credentials
      const result = await api.loginWithCredentials(
        credentials.username,
        credentials.password,
        getDeviceName(),
      );
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

    // Update remote connection manager
    remoteConnectionManager.setAuthenticated(
      api.serverInfo.value?.server_id || undefined,
    );

    // Continue with normal app initialization
    await initializeApp();

    // Mark as authenticated only after successful initialization
    isAuthenticated.value = true;
    store.isAuthenticated = true;
  } catch (error) {
    console.error("[App] Authentication failed:", error);

    // Make sure we're not marked as authenticated
    isAuthenticated.value = false;
    store.isAuthenticated = false;

    // Notify Login component about the authentication failure
    if (loginComponent.value) {
      (loginComponent.value as any).handleAuthenticationError(error);
    }
  }
};

/**
 * Handle local connection from login screen
 * Just establishes the WebSocket connection - authentication handled by handleRemoteAuthenticated
 */
const handleLocalConnect = async (serverAddress: string) => {
  // Set base URL for auth manager
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);

  // Pass the HTTP base URL to api.initialize - it will build the WebSocket URL
  await api.initialize(serverAddress);
  isConnected.value = true;
};

/**
 * Initialize the app after connection is established
 */
const initializeApp = async () => {
  // Builtin player is disabled for remote connections as it uses HTTP which is not
  // compatible with WebRTC transport. This will be replaced by the Resonate protocol.
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") !=
      "false" && !api.isRemoteConnection.value;

  // Helper function to complete initialization
  const completeInitialization = async () => {
    const serverInfo = api.serverInfo.value;
    if (!serverInfo) {
      console.error("No server info received");
      return;
    }

    store.serverInfo = serverInfo;
    store.isAuthenticated = true;

    // Set webPlayer baseUrl from api.baseUrl
    if (api.baseUrl) {
      webPlayer.setBaseUrl(api.baseUrl);
    }

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

    // Handle onboarding flow if onboard=true query parameter is present
    const urlParams = new URLSearchParams(window.location.search);
    if (urlParams.get("onboard") === "true") {
      store.isOnboarding = true;
      // Navigate to providers settings page
      router.push("/settings/providers");
    }
  };

  // Subscribe to CONNECTED event for future reconnections
  api.subscribe(EventType.CONNECTED, completeInitialization);

  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
    // Reset authentication state to force re-authentication
    isAuthenticated.value = false;
    store.isAuthenticated = false;
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

  // Login screen shows by default (isAuthenticated = false)
  // Login.vue has smart auto-connect that handles local and remote connections

  // Handle audio interaction requirement
  window.addEventListener("click", interactedHandler);
});
</script>
