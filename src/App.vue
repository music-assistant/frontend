<template>
  <div>
    <v-container v-if="setup" fill-height class="d-flex align-center justify-center h-screen">
      <v-sheet width="350" class="mx-auto rounded-lg">
        <v-form style="padding-left: 15px; padding-right: 15px" @submit="start">
          <v-card-title class="my-3">Music Assistant server details</v-card-title>
          <v-text-field v-model="ip" variant="outlined" label="IP / Hostname" placeholder="homeassistant.local" />
          <v-text-field v-model="port" variant="outlined" type="number" label="Port" placeholder="8095" />
          <v-card-title class="my-3">Client settings</v-card-title>
          <v-switch v-model="discordRPCEnabled" label="Start Discord rich presence" @change="discordRpcConfig" />
          <v-switch v-model="squeezeliteEnabled" label="Start Squeezelite" @change="squeezeliteConfig" />
          <v-switch v-model="darkThemeEnabled" label="Dark theme" @change="themeConfig" />
          <v-btn type="submit" block class="mb-5" text="Start" />
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

const setup = ref(true);
const discordRPCEnabled = ref(false);
const squeezeliteEnabled = ref(false);
const darkThemeEnabled = ref(false);
const port = ref(8095);
const ip = ref('homeassistant.local');

// methods
const discordRpcConfig = () => {
  localStorage.setItem('discordRPCEnabled', discordRPCEnabled.value.toString());
};

const squeezeliteConfig = () => {
  localStorage.setItem('squeezeliteEnabled', squeezeliteEnabled.value.toString());
};

const themeConfig = () => {
  console.log(darkThemeEnabled.value.toString());
  localStorage.setItem('darkThemeEnabled', darkThemeEnabled.value.toString());
  if (darkThemeEnabled.value.toString() == 'true') {
    theme.global.name.value = 'dark';
  } else {
    theme.global.name.value = 'light';
  }
};

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

//functions
function changeThemeColor() {
  if (!curQueueItem.value) {
    themeColor({
      lightColor: '',
      darkColor: '',
    });
  } else {
    themeColor(store.coverImageColorCode);
  }
}

// watchers
watch(
  () => activePlayerQueue.value?.display_name,
  () => {
    changeThemeColor();
  },
);

watch(
  () => store.coverImageColorCode,
  () => {
    changeThemeColor();
  },
);

onMounted(() => {
  // Set to previus settings
  let ip_storage = localStorage.getItem('mass_ip') || 'homeassistant.local';
  let port_storage = Number(localStorage.getItem('mass_port')) || 8095;
  let start_discord_rpc = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  let start_squeezelite = localStorage.getItem('squeezeliteEnabled') === 'true' || false;
  let dark_theme = localStorage.getItem('darkThemeEnabled') === 'true' || false;

  discordRPCEnabled.value = start_discord_rpc;
  squeezeliteEnabled.value = start_squeezelite;
  darkThemeEnabled.value = dark_theme;
  ip.value = ip_storage;
  port.value = port_storage;

  themeConfig();
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
