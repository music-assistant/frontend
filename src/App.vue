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

  <!-- Main app (when authenticated) -->
  <router-view v-else />

  <PlayerBrowserMediaControls
    v-if="
      webPlayer.audioSource === WebPlayerMode.CONTROLS_ONLY &&
      webPlayer.interacted == true
    "
  />
  <ResonatePlayer
    v-if="webPlayer.tabMode === WebPlayerMode.RESONATE && webPlayer.player_id"
    :player-id="webPlayer.player_id"
  />
  <BuiltinPlayer
    v-if="webPlayer.tabMode === WebPlayerMode.BUILTIN && webPlayer.player_id"
    :player-id="webPlayer.player_id"
  />
</template>

<script setup lang="ts">
import { api, ConnectionState } from "@/plugins/api";
import { getDeviceName } from "@/plugins/api/helpers";
import { i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onMounted, ref, computed, watch } from "vue";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";
import ResonatePlayer from "./components/ResonatePlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import Login from "./views/Login.vue";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import { remoteConnectionManager } from "./plugins/remote";
import type { ITransport } from "./plugins/remote/transport";
import { useRouter } from "vue-router";

const theme = useTheme();
const router = useRouter();

const isConnected = ref(false);
const loginComponent = ref<InstanceType<typeof Login> | null>(null);
const showLogin = computed(
  () => api.state.value !== ConnectionState.AUTHENTICATED,
);

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

const handleRemoteConnected = async (transport: ITransport) => {
  isConnected.value = true;

  try {
    await api.initialize(transport);
  } catch (error) {
    console.error("[App] Failed to initialize API with transport:", error);
  }
};

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
      authManager.setCurrentUser(credentials.user);
      api.state.value = ConnectionState.AUTHENTICATED;
      await api.fetchState();
    } else if (credentials.token && credentials.user) {
      authManager.setToken(credentials.token);
      authManager.setCurrentUser(credentials.user);
    } else if (credentials.username && credentials.password) {
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
  } catch (error) {
    console.error("[App] Authentication failed:", error);
    if (loginComponent.value) {
      (loginComponent.value as any).handleAuthenticationError(error);
    }
  }
};

const handleLocalConnect = async (serverAddress: string) => {
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);
  await api.initialize(serverAddress);
  isConnected.value = true;
};

const completeInitialization = async () => {
  const serverInfo = api.serverInfo.value;
  if (!serverInfo) {
    console.error("[App] No server info received");
    return;
  }

  store.serverInfo = serverInfo;

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

  const webPlayerModePref =
    localStorage.getItem("frontend.settings.web_player_mode") || "builtin";

  // Remote connections don't support builtin or resonate players
  if (api.isRemoteConnection.value) {
    webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
  } else if (
    webPlayerModePref === "resonate" &&
    api.getProvider("resonate")?.available
  ) {
    webPlayer.setMode(WebPlayerMode.RESONATE);
  } else if (
    webPlayerModePref !== "disabled" &&
    api.getProvider("builtin_player")
  ) {
    // Fallback to builtin if resonate requested but unavailable, or if builtin explicitly selected
    webPlayer.setMode(WebPlayerMode.BUILTIN);
  } else {
    webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
  }

  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("onboard") === "true") {
    store.isOnboarding = true;
    router.push("/settings/providers");
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
  store.forceMobileLayout =
    localStorage.getItem("frontend.settings.force_mobile_layout") == "true";

  setTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);

  window.addEventListener("click", interactedHandler);

  watch(
    () => api.state.value,
    async (newState) => {
      if (newState === ConnectionState.CONNECTED) {
        const { authManager } = await import("@/plugins/auth");
        const storedToken = authManager.getToken();

        if (storedToken) {
          try {
            const result = await api.authenticateWithToken(storedToken);
            if (result.user) {
              authManager.setCurrentUser(result.user);
              store.currentUser = result.user;
            }
          } catch (error) {
            console.error("[App] Auto-authentication failed:", error);
          }
        } else {
          api.requireAuthentication();
        }
      }

      if (newState === ConnectionState.AUTHENTICATED) {
        await completeInitialization();
      }
    },
  );

  if (
    api.serverInfo.value &&
    api.state.value === ConnectionState.AUTHENTICATED
  ) {
    await completeInitialization();
  }
});
</script>
