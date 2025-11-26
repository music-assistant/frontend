<template>
  <VSonner position="bottom-right" />
  <router-view v-if="store.connected" />
  <v-progress-linear v-else indeterminate color="primary" />
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
import { onMounted } from "vue";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { EventType } from "./plugins/api/interfaces";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";

const theme = useTheme();

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

onMounted(async () => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  // cache some settings in the store
  const langPref = localStorage.getItem("frontend.settings.language") || "auto";
  if (langPref !== "auto") {
    i18n.global.locale.value = langPref;
  }
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";

  const forceMobileLayout =
    localStorage.getItem("frontend.settings.force_mobile_layout") == "true";
  store.forceMobileLayout = forceMobileLayout;

  // set color theme (and listen for color scheme changes from browser)
  setTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);

  // Initialize server address
  let serverAddress = "";
  if (process.env.NODE_ENV === "development") {
    serverAddress = localStorage.getItem("mass_debug_address") || "";
    if (!serverAddress) {
      serverAddress =
        prompt(
          "Enter location of the Music Assistant server",
          window.location.origin.replace("3000", "8095"),
        ) || "";
      localStorage.setItem("mass_debug_address", serverAddress);
    }
  } else {
    const loc = window.location;
    serverAddress = loc.origin + loc.pathname;
  }

  // Set base URL for auth manager
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);

  // Check if we're returning from login with a code in the URL query parameters
  const urlParams = new URLSearchParams(window.location.search);
  const codeParam = urlParams.get("code");
  let tokenFromLogin = false;

  if (codeParam) {
    console.info("Code received from login, storing and cleaning URL");
    // Store the code as token - validation will happen via WebSocket auth command
    authManager.setToken(codeParam);
    tokenFromLogin = true;

    // Clean up the URL by removing the code parameter
    urlParams.delete("code");
    const cleanUrl =
      window.location.pathname +
      (urlParams.toString() ? "?" + urlParams.toString() : "") +
      window.location.hash;
    window.history.replaceState({}, "", cleanUrl);
  }

  // Get auth token to pass to WebSocket (if available)
  const authToken = authManager.getToken();

  store.connected = false;

  // Subscribe to CONNECTED event to handle server info and auth requirements
  api.subscribe(EventType.CONNECTED, async () => {
    // Server info is now available from WebSocket
    const serverInfo = api.serverInfo.value;
    if (!serverInfo) {
      console.error("No server info received from WebSocket");
      return;
    }

    store.serverInfo = serverInfo;

    // Check if onboarding is needed
    if (!serverInfo.onboard_done) {
      console.info("Onboarding not done, redirecting to server setup");
      // Redirect to server's setup page with return URL and device name
      const returnUrl = encodeURIComponent(window.location.href);
      const deviceName = encodeURIComponent(getDeviceName());
      const baseUrl = serverAddress.endsWith("/")
        ? serverAddress.slice(0, -1)
        : serverAddress;
      window.location.href = `${baseUrl}/setup?return_url=${returnUrl}&device_name=${deviceName}`;
      return;
    }

    // User was authenticated via WebSocket auth command
    store.isAuthenticated = true;
    // Store current user from authManager (or localStorage if authManager hasn't updated yet)
    let currentUser = authManager.getCurrentUser();
    if (!currentUser) {
      // Race condition: authManager might not be updated yet, check localStorage
      const storedUser = localStorage.getItem("ma_current_user");
      if (storedUser) {
        try {
          currentUser = JSON.parse(storedUser);
          // Also update authManager to keep it in sync
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

    // enable the builtin player by default if the builtin player provider is available
    if (allowBuiltinPlayer && api.getProvider("builtin_player")) {
      webPlayer.setMode(WebPlayerMode.BUILTIN);
    } else {
      webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
    }
  });

  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
  });

  // Check if we have token when auth might be required
  // We don't know yet if auth is required until we connect, but if we have no token
  // and this is the first load (no token param), we should redirect to login
  // However, we'll let the WebSocket try first - it will fail and redirect if needed
  api.initialize(serverAddress, authToken, tokenFromLogin);
  webPlayer.setBaseUrl(serverAddress);

  //There is a safety rule in which you need to interact with the page for the audio to play
  window.addEventListener("click", interactedHandler);
});
</script>
