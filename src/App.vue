<template>
  <div>
    <v-container
      v-if="setup"
      fill-height
      fill-width
      class="d-flex align-center justify-center h-screen"
    >
      <v-progress-circular
        v-if="loading"
        indeterminate
        :size="60"
        :width="10"
        style="position: absolute"
      />
      <v-sheet v-if="!loading" width="350" class="mx-auto rounded-lg">
        <v-form
          style="padding-left: 15px; padding-right: 15px"
          @submit="try_start"
        >
          <v-card-title class="my-3" style="cursor: default"
            >Music Assistant server details</v-card-title
          >
          <v-text-field
            v-model="ip"
            variant="outlined"
            label="IP / Hostname"
            placeholder="homeassistant.local"
          />
          <v-text-field
            v-model="port"
            variant="outlined"
            style="height: 56px"
            type="number"
            label="Port"
            placeholder="8095"
          />
          <v-switch
            v-model="tls"
            style="height: 56px"
            label="Use TLS for server connection"
          />
          <v-card-title class="my-3" style="cursor: default; height: 32px"
            >Client settings</v-card-title
          >
          <v-switch
            v-model="discordRPCEnabled"
            style="height: 56px"
            label="Start Discord Rich Presence"
            @change="discordRpcConfig"
          />
          <!-- <v-switch
            v-model="closeToTrayEnabled"
            style="height: 56px"
            label="Close to tray"
            @change="closeToTrayConfig"
          /> -->
          <v-switch
            v-model="squeezeliteEnabled"
            style="height: 60px"
            label="Start Squeezelite"
            @change="squeezeliteConfig"
          />
          <v-text-field
            v-model="slimprotoPort"
            variant="outlined"
            style="height: 56px"
            type="number"
            label="Squeezelite port"
            placeholder="3483"
          />
          <v-card-subtitle style="cursor: default"
            >Theme Setting</v-card-subtitle
          >
          <v-btn-toggle
            v-model="themeSetting"
            style="width: 100%; margin-bottom: 12px"
            mandatory
            variant="outlined"
            divided
            rounded="lg"
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
          <v-select
            v-model="outputDevice"
            :items="availableOutputDevices"
            label="Output device"
            variant="outlined"
            @change="outputDevice"
          />
          <v-btn
            rounded="lg"
            variant="tonal"
            type="submit"
            :loading="loading"
            block
            class="mb-5"
            text="Start"
          />
        </v-form>
      </v-sheet>
    </v-container>
    <v-snackbar v-model="err" timeout="2500" color="error"
      >Error! {{ err_message }}</v-snackbar
    >
  </div>
  <router-view v-if="!setup && !loading" />
  <v-progress-linear v-else indeterminate color="primary" />
  <PlayerBrowserMediaControls />
</template>

<script setup lang="ts">
import { api } from "@/plugins/api";
import { onMounted, ref } from "vue";
import { useTheme } from "vuetify";
import { store } from "@/plugins/store";
import { invoke } from "@tauri-apps/api/core";
import { getCurrentWindow } from "@tauri-apps/api/window";

const setup = ref(true);
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(true);
const closeToTrayEnabled = ref(true);
const port = ref(8095);
const slimprotoPort = ref(3483);
const ip = ref("homeassistant.local");
const tls = ref(false);
const themeSetting = ref("light");
const outputDevice = ref("default");
const availableOutputDevices = ref(["default"]);
const loading = ref(true);
const err = ref(false);
const err_message = ref("Error!");
import { i18n } from "@/plugins/i18n";
import router from "./plugins/router";
import { EventType } from "./plugins/api/interfaces";
import PlayerBrowserMediaControls from "./layouts/default/PlayerOSD/PlayerBrowserMediaControls.vue";
import { WebsocketBuilder } from "websocket-ts";
const theme = useTheme();

// methods
const try_start = async () => {
  // Save ip and port
  localStorage.setItem("mass_ip", ip.value);
  localStorage.setItem("mass_port", port.value.toString());
  localStorage.setItem("mass_tls", tls.value.toString());
  localStorage.setItem("slimprotoPort", slimprotoPort.value.toString());
  localStorage.setItem("outputDevice", outputDevice.value);

  loading.value = true;
  // Try to connect to the websocket
  let protocol = tls.value ? "wss" : "ws";
  new WebsocketBuilder(`${protocol}://${ip.value}:${port.value}/ws`)
    .onOpen((i, ev) => {
      // If it sucessfully connects, start the app
      start();
      i.close();
      loading.value = false;
    })
    .onError(() => {
      // If it cant connect throw error
      err_message.value =
        "Could not connect to Music Assistant! Please check the ip and port";
      err.value = true;
      loading.value = false;
    })
    .build();
};

const discordRpcConfig = () => {
  localStorage.setItem("discordRPCEnabled", discordRPCEnabled.value.toString());
};

const themeSettingConfig = () => {
  localStorage.setItem("frontend.settings.theme", themeSetting.value);
  setTheme();
};

const setTheme = () => {
  const themePref = localStorage.getItem("frontend.settings.theme") || "auto";
  if (themePref == "dark") {
    theme.global.name.value = "dark";
  } else if (themePref == "light") {
    theme.global.name.value = "light";
  } else {
    theme.global.name.value = localStorage.getItem("systemTheme") || "light";
  }
};

const squeezeliteConfig = () => {
  localStorage.setItem(
    "squeezeliteEnabled",
    squeezeliteEnabled.value.toString(),
  );
};

const closeToTrayConfig = () => {
  localStorage.setItem(
    "closeToTrayEnabled",
    closeToTrayEnabled.value.toString(),
  );
};

onMounted(async () => {
  // Get available output devices
  invoke<string[]>("get_output_devices").then((message) => {
    availableOutputDevices.value = message;
  });

  // Set to previus settings
  let ip_storage = localStorage.getItem("mass_ip") || "homeassistant.local";
  let port_storage = Number(localStorage.getItem("mass_port")) || 8095;
  let tls_storage = localStorage.getItem("mass_tls") === "true" || false;
  let output_device_setting = localStorage.getItem("outputDevice") || "default";
  let slimproto_port_storage =
    Number(localStorage.getItem("slimprotoPort")) || 3483;
  let start_discord_rpc =
    localStorage.getItem("discordRPCEnabled") === "true" || false;
  let start_squeezelite =
    localStorage.getItem("squeezeliteEnabled") === "true" || true;
  let theme_setting = localStorage.getItem("frontend.settings.theme") || "auto";
  let tray_setting =
    localStorage.getItem("closeToTrayEnabled") === "true" || true;

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

  closeToTrayEnabled.value = tray_setting;
  discordRPCEnabled.value = start_discord_rpc;
  squeezeliteEnabled.value = start_squeezelite;
  ip.value = ip_storage;
  port.value = port_storage;
  tls.value = tls_storage;
  themeSetting.value = theme_setting;
  outputDevice.value = output_device_setting;
  slimprotoPort.value = slimproto_port_storage;

  // Set inital theme
  setTheme();
  await getCurrentWindow()
    .theme()
    .then((theme) => {
      if (theme != null) {
        localStorage.setItem("systemTheme", theme.toString());
        setTheme();
      }
    });

  // Update theme live
  await getCurrentWindow().onThemeChanged(({ payload: newTheme }) => {
    console.log(`Updated theme: ${newTheme.toString()}`);
    localStorage.setItem("systemTheme", newTheme.toString());
    setTheme();
  });

  // Try to start the app with saved config
  if (localStorage.getItem("mass_ip")) {
    try_start();
  } else {
    loading.value = false;
  }
});

const start = () => {
  let protocolHTTP = tls.value ? "https" : "http";
  let protocolWS = tls.value ? "wss" : "ws";
  // The server adress and websocket address
  let frontendServerAddress = `${protocolHTTP}://${ip.value}:${port.value}/`;
  let websocket = `${protocolWS}://${ip.value}:${port.value}/ws`;

  // Start discord rpc, squeezelite and the web app
  if (squeezeliteEnabled.value == true) {
    invoke("start_sqzlite", {
      ip: ip.value.toString(),
      outputDevice:
        outputDevice.value?.toString().split(" - ")?.[0]?.trim() ?? "default",
      port: slimprotoPort.value.toString(),
    });
  }
  if (discordRPCEnabled.value == true) {
    invoke("start_rpc", { websocket: websocket });
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
    setup.value = false;
  });
  api.subscribe(EventType.DISCONNECTED, () => {
    store.connected = false;
    setup.value = true;
  });
  api.initialize(frontendServerAddress);
};
</script>
