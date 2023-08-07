<template>
  <v-navigation-drawer
    v-if="getBreakpointValue({ breakpoint: 'bp3' })"
    ref="resizeComponent"
    app
    :permanent="!$vuetify.display.mobile"
    :rail="!$vuetify.display.mobile && !showNavigationMenu"
    :model-value="($vuetify.display.mobile && showNavigationMenu) || !$vuetify.display.mobile"
    :width="!getBreakpointValue('mobile') ? 200 : 250"
    @update:model-value="
      (e) => {
        if ($vuetify.display.mobile) showNavigationMenu = e;
      }
    "
  >
    <v-list-item dark style="height: 55px" :active="false">
      <template #prepend>
        <img
          class="logo_icon"
          :style="$vuetify.theme.current.dark ? 'filter: invert(100%);' : ''"
          width="35"
          src="@/assets/logo.svg"
        />
      </template>
      <template #title>
        <div class="logo_text">Music Assistant</div>
      </template>
    </v-list-item>
    <v-divider />

    <!-- menu items -->
    <v-list lines="one" density="compact" nav>
      <v-list-item
        v-for="menuItem of mainMenuItems"
        :key="menuItem.path"
        nav
        density="compact"
        :height="15"
        :title="$t(menuItem.label)"
        :prepend-icon="menuItem.icon"
        :to="menuItem.path"
      />
    </v-list>
    <!-- button at bottom to collapse/expand the navigation drawer-->
    <Button
      nav
      :height="15"
      :width="40"
      style="position: relative; float: right; right: 10px; top: 20px"
      :ripple="false"
      :icon="showNavigationMenu ? 'mdi-chevron-left' : 'mdi-chevron-right'"
      :title="$t('tooltip.show_menu')"
      @click.stop="showNavigationMenu = !showNavigationMenu"
    />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { getBreakpointValue } from '@/plugins/breakpoint';
import { store } from '@/plugins/store';
import { ref, watch } from 'vue';
import Button from '@/components/mods/Button.vue';

const showNavigationMenu = ref(false);

watch(
  () => showNavigationMenu.value,
  (isShown) => {
    isShown ? (store.navigationMenuSize = !getBreakpointValue('mobile') ? 200 : 250) : (store.navigationMenuSize = 55);
  },
);
</script>

<script lang="ts">
export const backButtonAllowedRouteNames = [
  'track',
  'artist',
  'album',
  'playlist',
  'radio',
  'addprovider',
  'editprovider',
  'editplayer',
  'editcore',
];

export interface MenuItem {
  label: string;
  icon: string;
  path: string;
}

export const mainMenuItems: MenuItem[] = [
  // disable Home until we have something useful to fill that screen
  {
    label: 'home',
    icon: 'mdi-home-outline',
    path: '/home',
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
    label: 'search',
    icon: 'mdi-magnify',
    path: '/search',
  },
  {
    label: 'settings.settings',
    icon: 'mdi-cog-outline',
    path: '/settings',
  },
];
</script>

<style>
.logo_text {
  margin-left: 25px;
  font-family: 'JetBrains Mono Medium';
  font-size: 55;
  font-weight: 500;
}

.logo_icon {
  margin-left: -5px;
  border-radius: 4px;
}
</style>
