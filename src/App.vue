<template>
  <router-view />
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
import { onMounted } from "vue";
import { useTheme } from "vuetify";
import { store } from "@/plugins/store";
import { i18n } from "@/plugins/i18n";
import router from "./plugins/router";
import { EventType } from "./plugins/api/interfaces";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { webPlayer, WebPlayerMode } from "./plugins/web_player";
import BuiltinPlayer from "./components/BuiltinPlayer.vue";

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

onMounted(() => {
  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  // set navigation menu style
  store.navigationMenuStyle =
    localStorage.getItem("frontend.settings.menu_style") || "horizontal";

  // cache some settings in the store
  const langPref = localStorage.getItem("frontend.settings.language") || "auto";
  if (langPref !== "auto") {
    i18n.global.locale.value = langPref;
  }
  const allowBuiltinPlayer =
    localStorage.getItem("frontend.settings.enable_builtin_player") != "false";

  // set color theme (and listen for color scheme changes from browser)
  setTheme();
  window
    .matchMedia("(prefers-color-scheme: dark)")
    .addEventListener("change", setTheme);
  // Initialize API Connection
  // TODO: retrieve serveraddress through discovery and/or user settings ?
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

  // connect/initialize api
  store.connected = false;
  api.subscribe(EventType.CONNECTED, async () => {
    // redirect the user to the settings page if this is a fresh install
    // TO be replaced with some nice onboarding wizard!
    if (api.serverInfo.value?.onboard_done === false) {
      console.info("Onboarding not done, redirecting to settings");
      router.push("/settings");
    }
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
  api.initialize(serverAddress);
  webPlayer.setBaseUrl(serverAddress);

  //There is a safety rule in which you need to interact with the page for the audio to play
  window.addEventListener("click", interactedHandler);
});
</script>
