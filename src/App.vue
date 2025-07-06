<template>
  <router-view v-if="connectionState === 'connected'" />
  <div v-else>
    <v-container
      fill-height
      fill-width
      class="d-flex align-center justify-center h-screen"
    >
      <v-progress-circular
        v-if="connectionState === 'connecting'"
        indeterminate
        :size="60"
        :width="10"
        style="position: absolute"
      />
      <v-sheet
        v-if="connectionState !== 'connected'"
        width="350"
        class="mx-auto rounded-lg"
      >
        <v-form
          style="padding-left: 15px; padding-right: 15px"
          @submit.prevent="test_connection"
        >
          <v-card-title class="my-3" style="cursor: default"
            >Music Assistant server details</v-card-title
          >
          <v-text-field
            v-model="music_assistant_hostname"
            variant="outlined"
            label="IP / Hostname"
            placeholder="homeassistant.local"
            :disabled="connectionState === 'connecting'"
          />
          <v-text-field
            v-model="music_assistant_port"
            variant="outlined"
            style="height: 56px"
            type="number"
            label="Port"
            placeholder="8095"
            :disabled="connectionState === 'connecting'"
          />
          <v-switch
            v-model="music_assistant_tls_enabled"
            style="height: 56px"
            label="Use TLS for server connection"
            :disabled="connectionState === 'connecting'"
          />
          <v-card-title class="my-3" style="cursor: default; height: 32px"
            >Client settings</v-card-title
          >
          <v-card-subtitle style="cursor: default"
            >Theme Setting</v-card-subtitle
          >
          <v-btn-toggle
            v-model="theme_mode"
            style="width: 100%; margin-bottom: 12px"
            mandatory
            variant="outlined"
            divided
            rounded="lg"
            :disabled="connectionState === 'connecting'"
            @update:model-value="themeSettingConfig"
          >
            <v-btn class="text-center" style="width: 35%" value="auto"
              >System</v-btn
            >
            <v-btn class="text-center" style="width: 35%" value="light"
              >Light</v-btn
            >
            <v-btn class="text-center" style="width: 35%" value="dark"
              >Dark</v-btn
            >
          </v-btn-toggle>
          <v-btn
            rounded="lg"
            variant="tonal"
            type="submit"
            :loading="connectionState === 'connecting'"
            block
            class="mb-2"
            text="Start"
            :disabled="connectionState === 'connecting'"
          />
          <v-btn
            v-if="connectionState === 'connecting'"
            rounded="lg"
            variant="outlined"
            block
            class="mb-5"
            text="Cancel"
            @click="cancelConnection"
          />
        </v-form>
      </v-sheet>
    </v-container>
    <v-snackbar v-model="showError" timeout="3500" color="error">
      Error! {{ error_message }}
    </v-snackbar>
  </div>
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
import { onMounted, onBeforeUnmount, ref } from "vue";
import { useTheme } from "vuetify";
import { store } from "@/plugins/store";
import { i18n } from "@/plugins/i18n";
import { EventType } from "./plugins/api/interfaces";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";
import { WebsocketBuilder } from "websocket-ts";

// --- State ---
const music_assistant_port = ref(8095);
const music_assistant_hostname = ref("homeassistant.local");
const music_assistant_tls_enabled = ref(false);
const theme_mode = ref("light");
const connectionState = ref("idle"); // TypeScript will infer the type as string
const error_message = ref("");
const showError = ref(false);
const theme = useTheme();
let wsInstance: any = null; // For canceling connection
let connectionTimeout: ReturnType<typeof setTimeout> | null = null;

// --- Theme Setting ---
const themeSettingConfig = () => {
  localStorage.setItem("frontend.settings.theme", theme_mode.value);
  setTheme();
};

// --- Connection Logic ---
const test_connection = async () => {
  if (connectionState.value === "connecting") return;
  // Save ip and port
  localStorage.setItem(
    "frontend.settings.server_address",
    music_assistant_hostname.value,
  );
  localStorage.setItem(
    "frontend.settings.server_port",
    music_assistant_port.value.toString(),
  );
  localStorage.setItem(
    "frontend.settings.server_tls_enabled",
    music_assistant_tls_enabled.value.toString(),
  );
  connectionState.value = "connecting";
  error_message.value = "";
  // Try to connect to the websocket
  let protocol = music_assistant_tls_enabled.value ? "wss" : "ws";
  let wsUrl = `${protocol}://${music_assistant_hostname.value}:${music_assistant_port.value}/ws`;
  let resolved = false;

  // Timeout after 5 seconds
  connectionTimeout = setTimeout(() => {
    if (!resolved) {
      resolved = true;
      if (wsInstance) wsInstance.close();
      connectionState.value = "error";
      error_message.value =
        "Connection timed out. Please check the IP and port.";
      showError.value = true;
    }
  }, 5000);

  wsInstance = new WebsocketBuilder(wsUrl)
    .withMaxRetries(1)
    .onOpen((i, ev) => {
      if (resolved) return;
      resolved = true;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      i.close();
      start();
      connectionState.value = "connected";
    })
    .onError(() => {
      if (resolved) return;
      resolved = true;
      if (connectionTimeout) clearTimeout(connectionTimeout);
      connectionState.value = "error";
      error_message.value =
        "Could not connect to Music Assistant! Please check the IP and port.";
      showError.value = true;
    })
    .build();
};

const cancelConnection = () => {
  if (connectionState.value !== "connecting") return;
  if (wsInstance) wsInstance.close();
  if (connectionTimeout) clearTimeout(connectionTimeout);
  connectionState.value = "idle";
};

// --- Theme Logic ---
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

// --- Web Player Interaction ---
const interactedHandler = function () {
  webPlayer.setInteracted();
  window.removeEventListener("click", interactedHandler);
};

// --- App Start Logic ---
const start = () => {
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";
  let protocolHTTP = music_assistant_tls_enabled.value ? "https" : "http";
  let protocolWS = music_assistant_tls_enabled.value ? "wss" : "ws";
  let frontendServerAddress = `${protocolHTTP}://${music_assistant_hostname.value}:${music_assistant_port.value}/`;
  let websocket = `${protocolWS}://${music_assistant_hostname.value}:${music_assistant_port.value}/ws`;
  store.connected = false;
  api.subscribe(EventType.CONNECTED, async () => {
    store.libraryArtistsCount = await api.getLibraryArtistsCount();
    store.libraryAlbumsCount = await api.getLibraryAlbumsCount();
    store.libraryPlaylistsCount = await api.getLibraryPlaylistsCount();
    store.libraryRadiosCount = await api.getLibraryRadiosCount();
    store.libraryTracksCount = await api.getLibraryTracksCount();
    store.connected = true;
    if (allowBuiltinPlayer && api.getProvider("builtin_player")) {
      webPlayer.setMode(WebPlayerMode.BUILTIN);
    } else {
      webPlayer.setMode(WebPlayerMode.CONTROLS_ONLY);
    }
  });
  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
  });
  api.initialize(frontendServerAddress);
  webPlayer.setBaseUrl(frontendServerAddress);
  window.addEventListener("click", interactedHandler);
};

// --- Lifecycle ---
onMounted(() => {
  // Restore previous settings
  music_assistant_hostname.value =
    localStorage.getItem("frontend.settings.server_address") ||
    "homeassistant.local";
  music_assistant_port.value =
    Number(localStorage.getItem("frontend.settings.server_port")) || 8095;
  music_assistant_tls_enabled.value =
    localStorage.getItem("frontend.settings.server_tls_enabled") === "true" ||
    false;
  theme_mode.value = localStorage.getItem("frontend.settings.theme") || "auto";
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;
  store.navigationMenuStyle =
    localStorage.getItem("frontend.settings.menu_style") || "horizontal";
  const langPref = localStorage.getItem("frontend.settings.language") || "auto";
  if (langPref !== "auto") {
    i18n.global.locale.value = langPref;
  }
  setTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);
  test_connection();
});

onBeforeUnmount(() => {
  if (wsInstance) wsInstance.close();
  if (connectionTimeout) clearTimeout(connectionTimeout);
  window.removeEventListener("click", interactedHandler);
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .removeEventListener("change", setTheme);
});
</script>
