<template>
  <div>
    <v-container v-if="setup" fill-height class="d-flex align-center justify-center h-screen">
      <v-sheet width="350" class="mx-auto rounded-lg">
        <v-form style="padding-left: 15px; padding-right: 15px" @submit="try_start">
          <v-card-title class="my-3" style="cursor: default">Music Assistant server details</v-card-title>
          <v-text-field v-model="ip" variant="outlined" label="IP / Hostname" placeholder="homeassistant.local" />
          <v-text-field v-model="port" variant="outlined" type="number" label="Port" placeholder="8095" />
          <v-card-title class="my-3" style="cursor: default">Client settings</v-card-title>
          <v-switch v-model="discordRPCEnabled" label="Start Discord Rich Presence" @change="discordRpcConfig" />
          <v-switch v-model="squeezeliteEnabled" label="Start Squeezelite" @change="squeezeliteConfig" />
          <v-card-subtitle style="cursor: default">Theme Setting</v-card-subtitle>
          <v-btn-toggle
            v-model="themeSetting"
            style="width: 100%; margin-bottom: 12px"
            mandatory
            rounded="lg"
            @update:model-value="themeSettingConfig"
          >
            <v-btn class="text-center" style="width: 35%" value="system">System</v-btn>
            <v-btn class="text-center" style="width: 35%" value="light">Light</v-btn>
            <v-btn class="text-center" style="width: 35%" value="dark">Dark</v-btn>
          </v-btn-toggle>
          <v-btn type="submit" :loading="loading" block class="mb-5" text="Start" />
        </v-form>
      </v-sheet>
    </v-container>
  </div>
  <router-view v-if="!setup" />
</template>

<script setup lang="ts">
import { api } from './plugins/api';
import { computed, onMounted, watch, ref } from 'vue';
import { useTheme } from 'vuetify';
import { store } from './plugins/store';
import { ColorCoverPalette, getContrastingTextColor } from '@/helpers/utils';
import { invoke } from '@tauri-apps/api/tauri';
import { appWindow } from '@tauri-apps/api/window';
import { WebsocketBuilder } from 'websocket-ts';
import { message } from '@tauri-apps/api/dialog';

const setup = ref(true);
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(false);
const port = ref(8095);
const ip = ref('homeassistant.local');
const themeSetting = ref('light');
const loading = ref(false);

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
const try_start = () => {
  loading.value = true;
  // Try to connect to the websocket
  let websocket = new WebsocketBuilder(`ws://${ip.value}:${port.value}/ws`);
  websocket.onOpen((i) => {
    // If it sucessfully connects, start the app
    start();
    i.close();
    loading.value = false;
  });
  websocket.onError((i, e) => {
    // If it cant connect throw error
    message('Could not connect to MA!', 'Please check the IP and Port');
    loading.value = false;
    i.close();
  });
  websocket.build();
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
  // Set to previus settings
  let ip_storage = localStorage.getItem('mass_ip') || 'homeassistant.local';
  let port_storage = Number(localStorage.getItem('mass_port')) || 8095;
  let start_discord_rpc = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  let start_squeezelite = localStorage.getItem('squeezeliteEnabled') === 'true' || false;
  let theme_setting = localStorage.getItem('themeSetting') || 'system';

  // @ts-ignore
  store.isInStandaloneMode = window.navigator.standalone || false;

  discordRPCEnabled.value = start_discord_rpc;
  squeezeliteEnabled.value = start_squeezelite;
  ip.value = ip_storage;
  port.value = port_storage;
  themeSetting.value = theme_setting;

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
  let websocket = new WebsocketBuilder(`ws://${ip.value}:${port.value}/ws`);
  websocket.onOpen((i) => {
    // If it sucessfully connects, start the app
    start();
    i.close();
  });
  websocket.build();
});

const start = () => {
  // Save ip and port
  localStorage.setItem('mass_ip', ip.value);
  localStorage.setItem('mass_port', port.value.toString());

  // The server adress and websocket address
  let frontendServerAddress = `http://${ip.value}:${port.value}/`;
  let websocket = `ws://${ip.value}:${port.value}/ws`;

  // Hide setup thing
  setup.value = false;

  // Start discord rpc, squeezelite and the web app
  if (squeezeliteEnabled.value == true) {
    invoke('start_sqzlite', { ip: ip.value });
  }
  if (discordRPCEnabled.value == true) {
    invoke('start_rpc', { websocket: websocket });
  }
  api.initialize(frontendServerAddress);
};
</script>
