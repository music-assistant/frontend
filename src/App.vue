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
  <router-view v-else-if="api.state.value == ConnectionState.INITIALIZED" />

  <PlayerBrowserMediaControls
    v-if="
      webPlayer.audioSource === WebPlayerMode.CONTROLS_ONLY &&
      webPlayer.interacted == true
    "
  />
  <SendspinPlayer
    v-if="webPlayer.tabMode === WebPlayerMode.SENDSPIN && webPlayer.player_id"
    :player-id="webPlayer.player_id"
  />
</template>

<script setup lang="ts">
import { api, ConnectionState } from "@/plugins/api";
import { getDeviceName } from "@/plugins/api/helpers";
import { i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, onMounted, ref, watch } from "vue";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import SendspinPlayer from "./components/SendspinPlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import Login from "./views/Login.vue";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import { remoteConnectionManager } from "./plugins/remote";
import type { ITransport } from "./plugins/remote/transport";
import { useRouter } from "vue-router";
import { authManager } from "@/plugins/auth";

const theme = useTheme();
const router = useRouter();

const loginComponent = ref<InstanceType<typeof Login> | null>(null);
const showLogin = computed(
  () => api.state.value !== ConnectionState.INITIALIZED,
);

const setTheme = function () {
  const themePref = localStorage.getItem("frontend.settings.theme") || "auto";
  if (themePref == "dark") {
    theme.global.name.value = "dark";
  } else if (themePref == "light") {
    theme.global.name.value = "light";
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    theme.global.name.value = "dark";
  } else {
    theme.global.name.value = localStorage.getItem("systemTheme") || "light";
  }
};

const interactedHandler = function () {
  webPlayer.setInteracted();
  window.removeEventListener("click", interactedHandler);
};

const handleRemoteConnected = async (transport: ITransport) => {
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
    let user = credentials.user;

    if (credentials.user && !credentials.token && !credentials.username) {
      // Ingress mode: user is already authenticated by the server
      authManager.setCurrentUser(credentials.user);
      api.state.value = ConnectionState.AUTHENTICATED;
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
  if (api.state.value !== ConnectionState.DISCONNECTED) {
    console.debug("[App] API already initialized, skipping");
    return;
  }
  authManager.setBaseUrl(serverAddress);
  await api.initialize(serverAddress);
};

const completeInitialization = async () => {
  const serverInfo = api.serverInfo.value;
  if (!serverInfo) {
    console.error("[App] No server info received");
    return;
  }
  const userInfo = await api.getCurrentUserInfo();
  if (!userInfo) {
    console.error("[App] No user info received");
    return;
  }
  authManager.setCurrentUser(userInfo);
  store.serverInfo = serverInfo;

  if (api.baseUrl) {
    webPlayer.setBaseUrl(api.baseUrl);
  }

  await api.fetchState();
  store.libraryArtistsCount = await api.getLibraryArtistsCount();
  store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
  store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
  store.libraryRadiosCount = await api.getLibraryRadiosCount();
  store.libraryTracksCount = await api.getLibraryTracksCount();

  const webPlayerModePref =
    localStorage.getItem("frontend.settings.web_player_mode") || "sendspin";
  if (
    webPlayerModePref !== "disabled" &&
    api.getProvider("sendspin")?.available
  ) {
    webPlayer.setMode(WebPlayerMode.SENDSPIN);
  } else {
    webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
  }
  const urlParams = new URLSearchParams(window.location.search);
  if (urlParams.get("onboard") === "true") {
    store.isOnboarding = true;
    router.push("/settings/providers");
  }
  api.state.value = ConnectionState.INITIALIZED;
};

onMounted(async () => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

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
    async (newState, oldState) => {
      if (
        newState === ConnectionState.CONNECTED &&
        oldState === ConnectionState.RECONNECTING
      ) {
        const isIngressMode =
          window.location.pathname.includes("/hassio_ingress/");

        if (isIngressMode) {
          try {
            const user = await api.getCurrentUserInfo();
            if (user) {
              authManager.setCurrentUser(user);
              api.state.value = ConnectionState.AUTHENTICATED;
            } else {
              api.requireAuthentication();
            }
          } catch (error) {
            console.error("[App] Ingress re-authentication failed:", error);
            api.requireAuthentication();
          }
        } else {
          const storedToken = authManager.getToken();

          if (storedToken) {
            try {
              const result = await api.authenticateWithToken(storedToken);
              if (result.user) {
                authManager.setCurrentUser(result.user);
              }
            } catch (error) {
              console.error(
                "[App] Re-authentication after reconnect failed:",
                error,
              );
              api.requireAuthentication();
            }
          } else {
            api.requireAuthentication();
          }
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
