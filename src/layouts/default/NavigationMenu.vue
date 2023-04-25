<template>
  <v-navigation-drawer
    ref="resizeComponent"
    app
    :permanent="!$vuetify.display.mobile"
    :rail="!$vuetify.display.mobile && !store.showNavigationMenu"
    :model-value="($vuetify.display.mobile && store.showNavigationMenu) || !$vuetify.display.mobile"
    :width="isMobileDevice(MobileDeviceType.ALL, $vuetify.display) ? 200 : newWidth"
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
import { MobileDeviceType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import { isMobileDevice } from '@/utils';
import { ref } from 'vue';

const menuItems = [
  {
    label: 'home',
    icon: 'mdi-home',
    path: '/home',
  },
  {
    label: 'search',
    icon: 'mdi-magnify',
    path: '/search',
  },
  {
    label: 'artists',
    icon: 'mdi-account-music',
    path: '/artists',
  },
  {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: 'mdi-file-music',
    path: '/tracks',
  },
  {
    label: 'radios',
    icon: 'mdi-radio',
    path: '/radios',
  },
  {
    label: 'playlists',
    icon: 'mdi-playlist-music',
    path: '/playlists',
  },
  {
    label: 'browse',
    icon: 'mdi-folder',
    path: '/browse',
  },
  {
    label: 'settings.settings',
    icon: 'mdi-cog',
    path: '/settings',
  },
];

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
};

const mouseUpHandler = () => {
  document.removeEventListener('mousemove', mouseMoveHandler);
  document.removeEventListener('mouseup', mouseUpHandler);
};
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
