<template>
  <v-navigation-drawer
    v-if="getBreakpointValue({ breakpoint: 'bp3' })"
    ref="resizeComponent"
    app
    :permanent="!$vuetify.display.mobile"
    :rail="!$vuetify.display.mobile && !store.showNavigationMenu"
    :model-value="($vuetify.display.mobile && store.showNavigationMenu) || !$vuetify.display.mobile"
    :width="!getBreakpointValue('mobile') ? 200 : 250"
    @update:model-value="
      (e) => {
        if ($vuetify.display.mobile) store.showNavigationMenu = e;
      }
    "
  >
    <v-list lines="one" density="compact" nav>
      <v-list-item
        nav
        density="compact"
        :height="15"
        :width="40"
        style="margin-left: auto"
        :ripple="false"
        :prepend-icon="store.showNavigationMenu ? 'mdi-chevron-left' : 'mdi-chevron-right'"
        @click.stop="store.showNavigationMenu = !store.showNavigationMenu"
      />

      <v-list-item
        v-for="menuItem of menuItems"
        :key="menuItem.path"
        nav
        density="compact"
        :height="15"
        :title="$t(menuItem.label)"
        :prepend-icon="menuItem.icon"
        :to="menuItem.path"
      />
    </v-list>
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { getBreakpointValue } from '@/plugins/breakpoint';
import { store } from '@/plugins/store';
import { watch } from 'vue';

const menuItems = [
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
  {
    label: 'browse',
    icon: 'mdi-folder-outline',
    path: '/browse',
  },
  {
    label: 'settings.settings',
    icon: 'mdi-cog-outline',
    path: '/settings',
  },
];

watch(
  () => store.showNavigationMenu,
  (isShown) => {
    isShown ? (store.sizeNavigationMenu = !getBreakpointValue('mobile') ? 200 : 250) : (store.sizeNavigationMenu = 55);
  },
);
</script>
