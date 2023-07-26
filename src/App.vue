<template>
  <router-view />
</template>

<script setup lang="ts">
import { api } from './plugins/api';
import { computed, onMounted, watch } from 'vue';
import { useTheme } from 'vuetify';
import { store } from './plugins/store';
import { ColorCoverPalette, getContrastingTextColor } from '@/helpers/utils';
import { invoke } from '@tauri-apps/api/tauri';

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
  // Just dark theme for now
  theme.global.name.value = 'dark';

  // Get the mass ip
  let serverAddressStorage = localStorage.getItem('mass_ip') || '';
  let start_discord_rpc = localStorage.getItem('discordRPCEnabled') === 'true' || false;
  let start_squeezelite = localStorage.getItem('squeezeliteEnabled') === 'true' || false;
  let ip = '';

  // Promt the user for the IP
  if (!serverAddressStorage) {
    ip = prompt('Enter the ip/hostname of the Music Assistant server', 'homeassistant.local') || '';
  } else {
    ip = prompt('Enter the ip/hostname of the Music Assistant server', serverAddressStorage) || '';
  }

  // Store the new ip
  localStorage.setItem('mass_ip', ip);

  // The server adress and websocket address
  let serverAddress = `http://${ip}:8095/`;
  let websocket = `ws://${ip}:8095/ws`;

  console.log(start_discord_rpc.toString());

  // Start discord rpc, squeezelite and the web app
  if (start_squeezelite == true) {
    invoke('start_sqzlite', { ip: ip });
  }
  if (start_discord_rpc == true) {
    invoke('start_rpc', { websocket: websocket });
  }
  api.initialize(serverAddress);
});
</script>
