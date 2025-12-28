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

  <!-- Main app (when authenticated and service worker ready for remote) -->
  <router-view v-else-if="showMainApp" />

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
import authManager from "@/plugins/auth";
import { i18n } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { useColorMode } from "@vueuse/core";
import { computed, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { useTheme } from "vuetify";
import { VSonner } from "vuetify-sonner";
import "vuetify-sonner/style.css";
import SendspinPlayer from "./components/SendspinPlayer.vue";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { remoteConnectionManager } from "./plugins/remote";
import { httpProxyBridge } from "./plugins/remote/http-proxy";
import type { ITransport } from "./plugins/remote/transport";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import Login from "./views/Login.vue";
import { useUserPreferences } from "@/composables/userPreferences";

const theme = useTheme();
const router = useRouter();
const mode = useColorMode();

const isConnected = ref(false);
const loginComponent = ref<InstanceType<typeof Login> | null>(null);
const showLogin = computed(
  () => api.state.value !== ConnectionState.INITIALIZED,
);

// Show main app when API is initialized AND (not remote OR service worker is ready)
const showMainApp = computed(() => {
  if (api.state.value !== ConnectionState.INITIALIZED) {
    return false;
  }
  // For remote connections, also require service worker to be ready
  if (api.isRemoteConnection.value && !httpProxyBridge.isReady.value) {
    return false;
  }
  return true;
});

const setTheme = function () {
  // Read from user preferences first, fallback to localStorage for migration
  const themePref =
    store.currentUser?.preferences?.theme ||
    localStorage.getItem("frontend.settings.theme") ||
    "auto";
  let themeValue: "light" | "dark";

  if (themePref == "dark") {
    // forced dark mode
    theme.global.name.value = "dark";
    themeValue = "dark";
  } else if (themePref == "light") {
    // forced light mode
    theme.global.name.value = "light";
    themeValue = "light";
  } else if (
    window.matchMedia &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  ) {
    // dark mode is enabled in browser
    theme.global.name.value = "dark";
    themeValue = "dark";
  } else {
    // light mode is enabled in browser
    theme.global.name.value = "light";
    themeValue = "light";
  }

  mode.value = themePref === "auto" ? "auto" : themeValue;
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
  if (api.state.value !== ConnectionState.DISCONNECTED) {
    console.debug("[App] API already initialized, skipping");
    return;
  }
  const { authManager } = await import("@/plugins/auth");
  authManager.setBaseUrl(serverAddress);
  await api.initialize(serverAddress);
  isConnected.value = true;
};

// TODO: Remove this migration code in v2.9 release
// Added in: current version
// Can be removed: v2.9
async function migrateLocalStorageToUserPreferences() {
  // Check if migration already done
  if (
    localStorage.getItem("frontend.settings.migrated_to_user_prefs") === "true"
  ) {
    return;
  }

  const { setPreference } = useUserPreferences();
  const settingsToMigrate = ["theme", "language", "startup_view", "menu_items"];

  try {
    for (const key of settingsToMigrate) {
      const value = localStorage.getItem(`frontend.settings.${key}`);
      if (value !== null && !store.currentUser?.preferences?.[key]) {
        // Only migrate if backend doesn't already have a value
        console.log(`[Migration] Migrating ${key} to user preferences:`, value);
        await setPreference(key, value);
      }
    }

    localStorage.setItem("frontend.settings.migrated_to_user_prefs", "true");
    console.log(
      "[Migration] Successfully migrated frontend settings to user preferences",
    );
  } catch (error) {
    console.error("[Migration] Failed to migrate settings:", error);
  }
}

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

  // TODO: Remove this migration code in v2.9 release
  // Migrate localStorage settings to user preferences (one-time migration)
  await migrateLocalStorageToUserPreferences();

  if (api.baseUrl) {
    webPlayer.setBaseUrl(api.baseUrl);
  }

  await api.fetchState();
  store.libraryArtistsCount = await api.getLibraryArtistsCount();
  store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
  store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
  store.libraryRadiosCount = await api.getLibraryRadiosCount();
  store.libraryTracksCount = await api.getLibraryTracksCount();
  store.libraryPodcastsCount = await api.getLibraryPodcastsCount();
  store.libraryAudiobooksCount = await api.getLibraryAudiobooksCount();

  // Enable Sendspin if available and not explicitly disabled
  // Sendspin works over WebRTC DataChannel which requires signaling via the API server
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
  if (
    (urlParams.get("onboard") === "true" ||
      serverInfo.onboard_done === false) &&
    userInfo.role === "admin"
  ) {
    store.isOnboarding = true;
    router.push("/settings/providers");
  }
  api.state.value = ConnectionState.INITIALIZED;
};

onMounted(async () => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  // Cache language settings - read from user preferences first, fallback to localStorage
  const langPref =
    store.currentUser?.preferences?.language ||
    localStorage.getItem("frontend.settings.language") ||
    "auto";
  if (langPref !== "auto") {
    i18n.global.locale.value = langPref;
  }
  store.forceMobileLayout =
    localStorage.getItem("frontend.settings.force_mobile_layout") == "true";

  setTheme();

  // Watch for user data changes and reapply theme/language
  watch(
    () => store.currentUser,
    (newUser) => {
      if (newUser) {
        setTheme();
        const userLangPref = newUser.preferences?.language || "auto";
        if (userLangPref !== "auto") {
          i18n.global.locale.value = userLangPref;
        }
      }
    },
  );
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);

  window.addEventListener("click", interactedHandler);

  watch(
    () => api.state.value,
    async (newState, oldState) => {
      // Re-authenticate on reconnection (not initial connection - Login.vue handles that)
      if (
        newState === ConnectionState.CONNECTED &&
        oldState === ConnectionState.RECONNECTING
      ) {
        const { authManager } = await import("@/plugins/auth");
        // Check if we're in Ingress mode by examining the URL path
        const isIngressMode =
          window.location.pathname.includes("/hassio_ingress/");

        if (isIngressMode) {
          // In Ingress mode, authentication happens via HA proxy headers
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
          // Normal mode: use token authentication
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
