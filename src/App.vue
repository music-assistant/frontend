<template>
  <div>
    <v-container v-if="setup" fill-height fill-width class="d-flex align-center justify-center h-screen">
      <v-progress-circular v-if="loading" indeterminate :size="60" :width="10" style="position: absolute" />
      <v-sheet v-if="!loading" width="350" class="mx-auto rounded-lg">
        <v-form style="padding-left: 15px; padding-right: 15px" @submit="try_start">
          <v-card-title class="my-3" style="cursor: default">Music Assistant server details</v-card-title>
          <v-text-field v-model="ip" variant="outlined" label="IP / Hostname" placeholder="homeassistant.local" />
          <v-text-field
            v-model="port"
            variant="outlined"
            style="height: 56px"
            type="number"
            label="Port"
            placeholder="8095"
          />
          <v-card-title class="my-3" style="cursor: default; height: 32px">Client settings</v-card-title>
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
          <v-card-subtitle style="cursor: default">Theme Setting</v-card-subtitle>
          <v-btn-toggle
            v-model="themeSetting"
            style="width: 100%; margin-bottom: 12px"
            mandatory
            variant="outlined"
            divided
            rounded="lg"
            @update:model-value="themeSettingConfig"
          >
            <v-btn class="text-center" style="width: 35%" value="system">System</v-btn>
            <v-btn class="text-center" style="width: 35%" value="light">Light</v-btn>
            <v-btn class="text-center" style="width: 35%" value="dark">Dark</v-btn>
          </v-btn-toggle>
          <v-select
            v-model="outputDevice"
            :items="availableOutputDevices"
            label="Output device"
            variant="outlined"
            @change="outputDevice"
          />
          <v-btn rounded="lg" variant="tonal" type="submit" :loading="loading" block class="mb-5" text="Start" />
        </v-form>
      </v-sheet>
    </v-container>
    <v-snackbar v-model="err" timeout="2500" color="error">Error! {{ err_message }}</v-snackbar>
  </div>
  <router-view v-if="!setup && !loading" />
</template>

<script setup lang="ts">
import { api } from './plugins/api';
import { computed, onMounted, ref } from 'vue';
import { useTheme } from 'vuetify';
import { store } from './plugins/store';
import { ColorCoverPalette, getContrastingTextColor } from '@/helpers/utils';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import WebSocket from 'tauri-plugin-websocket-api';

const setup = ref(true);
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(true);
const closeToTrayEnabled = ref(true);
const port = ref(8095);
const ip = ref('homeassistant.local');
const themeSetting = ref('light');
const outputDevice = ref('default');
const availableOutputDevices = ref(['default']);
const loading = ref(true);
const err = ref(false);
const err_message = ref('Error!');

const theme = useTheme();
let lightTheme = theme.themes.value.light;
let darkTheme = theme.themes.value.dark;

const themeColor = function (colors: ColorCoverPalette) {
  lightTheme.colors['primary'] = colors.lightColor || '#03a9f4';
  lightTheme.colors['on-primary'] = getContrastingTextColor(colors.lightColor) || '#fff';
  lightTheme.colors['secondary'] = colors.darkColor || '#ff9800';
  lightTheme.colors['on-secondary'] = getContrastingTextColor(colors.darkColor) || '#fff';
  lightTheme.variables['medium-emphasis-opacity'] = 1;

  darkTheme.colors['primary'] = colors.darkColor || '#0288d1';
  darkTheme.colors['on-primary'] = getContrastingTextColor(colors.darkColor) || '#fff';
  darkTheme.colors['secondary'] = colors.lightColor || '#ff9800';
  darkTheme.colors['on-secondary'] = getContrastingTextColor(colors.lightColor) || '#fff';
  darkTheme.variables['medium-emphasis-opacity'] = 1;
};

// methods
const try_start = async () => {
  // Save ip and port
  localStorage.setItem('mass_ip', ip.value);
  localStorage.setItem('mass_port', port.value.toString());
  localStorage.setItem('outputDevice', outputDevice.value);

  loading.value = true;
  // Try to connect to the websocket
  await WebSocket.connect(`ws://${ip.value}:${port.value}/ws`)
    .then((i) => {
      // If it sucessfully connects, start the app
      start();
      i.disconnect();
      loading.value = false;
    })
    .catch(() => {
      // If it cant connect throw error
      err_message.value = 'Could not connect to Music Assistant! Please check the ip and port';
      err.value = true;
      loading.value = false;
    });
};

const discordRpcConfig = () => {
  localStorage.setItem('discordRPCEnabled', discordRPCEnabled.value.toString());
};

const themeSettingConfig = () => {
  localStorage.setItem('themeSetting', themeSetting.value);
  if (themeSetting.value == 'dark') {
    theme.global.name.value = 'dark';
  } else if (themeSetting.value == 'light') {
    theme.global.name.value = 'light';
  } else {
    theme.global.name.value = localStorage.getItem('systemTheme') || 'light';
  }
};

const squeezeliteConfig = () => {
  localStorage.setItem('squeezeliteEnabled', squeezeliteEnabled.value.toString());
};

const closeToTrayConfig = () => {
  localStorage.setItem('closeToTrayEnabled', closeToTrayEnabled.value.toString());
};

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});

onMounted(async () => {
  // Get available output devices
  invoke<string[]>('get_output_devices').then((message) => {
    // Move default to the top
    message.splice(message.indexOf('default'), 1);
    message.unshift('default');

    availableOutputDevices.value = message;
  });

  // Set to previus settings
  let ip_storage = localStorage.getItem('mass_ip') || 'homeassistant.local';
  let port_storage = Number(localStorage.getItem('mass_port')) || 8095;
  let output_device_setting = localStorage.getItem('outputDevice') || 'default';
  let start_discord_rpc = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  let start_squeezelite = localStorage.getItem('squeezeliteEnabled') === 'true' || true;
  let theme_setting = localStorage.getItem('themeSetting') || 'system';
  let tray_setting = localStorage.getItem('closeToTrayEnabled') === 'true' || true;

  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  closeToTrayEnabled.value = tray_setting;
  discordRPCEnabled.value = start_discord_rpc;
  squeezeliteEnabled.value = start_squeezelite;
  ip.value = ip_storage;
  port.value = port_storage;
  themeSetting.value = theme_setting;
  outputDevice.value = output_device_setting;

  // Set inital theme
  await appWindow.theme().then((theme) => {
    if (theme != null) {
      localStorage.setItem('systemTheme', theme.toString());
      themeSettingConfig();
    }
  });

  // Update theme live
  await appWindow.onThemeChanged(({ payload: newTheme }) => {
    console.log(`Updated theme: ${newTheme.toString()}`);
    localStorage.setItem('systemTheme', newTheme.toString());
    themeSettingConfig();
  });

  // Try to start the app with saved config
  if (localStorage.getItem('mass_ip')) {
    try_start();
  } else {
    loading.value = false;
  }
});

const start = () => {
  // The server adress and websocket address
  let frontendServerAddress = `http://${ip.value}:${port.value}/`;
  let websocket = `ws://${ip.value}:${port.value}/ws`;

  // Start discord rpc, squeezelite and the web app
  if (squeezeliteEnabled.value == true) {
    invoke('start_sqzlite', { ip: ip.value, outputDevice: outputDevice.value });
  }
  if (discordRPCEnabled.value == true) {
    invoke('start_rpc', { websocket: websocket });
  }
  api.initialize(frontendServerAddress);

  // Hide setup thing
  setup.value = false;
  loading.value = false;
};
</script>
