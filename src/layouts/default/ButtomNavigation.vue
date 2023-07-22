<template>
  <v-bottom-navigation color="secondary" :active="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })" grow>
    <v-window :show-arrows="false" :touch="false" :continuous="false" :model-value="pageValue">
      <v-window-item>
        <v-btn
          v-for="menuItem of mainMenuItems"
          :key="menuItem.path"
          nav
          density="compact"
          :to="menuItem.path"
          @click="menuItem.click"
        >
          <v-icon>{{ menuItem.icon }}</v-icon>
          <h6>{{ $t(menuItem.label) }}</h6>
        </v-btn>
      </v-window-item>

      <v-window-item :style="{ display: pageValue == 1 ? 'flex' : 'none' }">
        <v-btn nav density="compact" @click="() => (pageValue -= 1)">
          <v-icon icon="mdi-arrow-left" />
          <h6>{{ $t('back') }}</h6>
        </v-btn>

        <div style="display: flex; overflow: auto">
          <v-btn v-for="menuItem of libraryMenuItems" :key="menuItem.path" nav density="compact" :to="menuItem.path">
            <v-icon>{{ menuItem.icon }}</v-icon>
            <h6>{{ $t(menuItem.label) }}</h6>
          </v-btn>
        </div>
      </v-window-item>
    </v-window>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { getBreakpointValue } from '@/plugins/breakpoint';
import { store } from '@/plugins/store';
import { ref } from 'vue';
import { watch } from 'vue';

//refs
const pageValue = ref(0);

const mainMenuItems = [
  {
    label: 'home',
    icon: 'mdi-home-outline',
    path: '/home',
  },
  {
    label: 'search',
    icon: 'mdi-magnify',
    path: '/search',
  },
  {
    label: 'library',
    icon: 'mdi-book',
    click: () => (pageValue.value += 1),
  },
];

const libraryMenuItems = [
  {
    label: 'artists',
    icon: 'mdi-account-outline',
    path: '/artists',
  },
  {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: 'mdi-music-note',
    path: '/tracks',
  },
  {
    label: 'playlists',
    icon: 'mdi-playlist-play',
    path: '/playlists',
  },
  {
    label: 'radios',
    icon: 'mdi-access-point',
    path: '/radios',
  },
];

watch(
  () => store.showNavigationMenu,
  (isShown) => {
    isShown ? (store.sizeNavigationMenu = !getBreakpointValue('mobile') ? 200 : 250) : (store.sizeNavigationMenu = 55);
  },
);
</script>
