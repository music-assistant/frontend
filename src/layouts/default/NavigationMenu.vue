<template>
  <v-navigation-drawer
    ref="resizeComponent"
    app
    :permanent="!$vuetify.display.mobile"
    :rail="!$vuetify.display.mobile && !store.showNavigationMenu"
    :model-value="($vuetify.display.mobile && store.showNavigationMenu) || !$vuetify.display.mobile"
    :width="!getBreakpointValue('mobile') ? 200 : newWidth"
    @update:model-value="
      (e) => {
        if ($vuetify.display.mobile) store.showNavigationMenu = e;
      }
    "
  >
    <div style="height: 20px" />
    <div ref="resizer" class="resize" @mousedown="mouseDownHandler"></div>
    <v-list lines="one" density="compact" nav>
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
import ItemsListing from '@/components/ItemsListing.vue';
import api from '@/plugins/api';
import { Playlist } from '@/plugins/api/interfaces';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { store } from '@/plugins/store';
import { watch, ref } from 'vue';

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

//refs
const resizer = ref<HTMLElement | null>(null);
const resizeComponent = ref<HTMLElement | null>(null);

let oldWidth = 300;
let newWidth = ref(300);
const maxWidth = 520;
const minWidth = 55;
let x = 0;
let y = 0;

const mouseDownHandler = (e: MouseEvent) => {
  x = e.clientX;
  y = e.clientY;

  //@ts-ignore
  oldWidth = resizeComponent.value?.width || 0;
  document.addEventListener('mousemove', mouseMoveHandler);
  document.addEventListener('mouseup', mouseUpHandler);
};

const mouseMoveHandler = (e: MouseEvent) => {
  const dx = e.clientX - x;
  if (newWidth.value >= maxWidth && dx > 0) {
    return;
  }
  if (newWidth.value <= minWidth && dx < 0) {
    return;
  }
  newWidth.value = oldWidth + dx;
  store.sizeNavigationMenu = newWidth.value;
};

const mouseUpHandler = () => {
  document.removeEventListener('mousemove', mouseMoveHandler);
  document.removeEventListener('mouseup', mouseUpHandler);
};

watch(
  () => store.showNavigationMenu,
  (isShown) => {
    isShown ? (store.sizeNavigationMenu = newWidth.value) : (store.sizeNavigationMenu = 55);
  },
);
</script>

<style>
.resize {
  height: 100%;
  width: 8px;
  z-index: 1;
  position: absolute;
  top: 0px;
  right: 0px;
}

.resize:hover {
  cursor: col-resize;
}
</style>
