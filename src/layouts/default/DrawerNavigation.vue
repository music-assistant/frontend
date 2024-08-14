<template>
  <v-navigation-drawer
    v-model="showNavigationMenu"
    app
    :rail="enableRail"
    :width="280"
  >
    <v-list-item style="height: 55px" :active="false">
      <template #prepend>
        <img class="logo_icon" size="40" src="@/assets/icon.png" />
      </template>
      <template #title>
        <div class="logo_text">Music Assistant</div>
      </template>
    </v-list-item>
    <v-divider />

    <!-- menu items -->
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
    <!-- button at bottom to collapse/expand the navigation drawer-->
    <Button
      nav
      :height="15"
      :width="40"
      style="position: relative; float: right; right: 10px; top: 20px"
      :ripple="false"
      :icon="enableRail ? 'mdi-chevron-right' : 'mdi-chevron-left'"
      :title="$t('tooltip.show_menu')"
      @click="enableRail = !enableRail"
    />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import Button from '@/components/mods/Button.vue';

const showNavigationMenu = ref(true);
const enableRail = ref(false);
const menuItems = getMenuItems();
</script>

<script lang="ts">
export interface MenuItem {
  label: string;
  icon: string;
  path: string;
  isLibraryNode: boolean;
}

export const DEFAULT_MENU_ITEMS = [
  'home',
  'search',
  'artists',
  'albums',
  'tracks',
  'playlists',
  'radios',
  'browse',
];

export const getMenuItems = function () {
  const storedMenuConf = localStorage.getItem('frontend.settings.menu_items');
  const enabledItems: string[] = storedMenuConf
    ? storedMenuConf.split(',')
    : DEFAULT_MENU_ITEMS;

  const items: MenuItem[] = [];

  if (enabledItems.includes('home')) {
    items.push({
      label: 'home',
      icon: 'mdi-home-outline',
      path: '/home',
      isLibraryNode: false,
    });
  }
  if (enabledItems.includes('search')) {
    items.push({
      label: 'search',
      icon: 'mdi-magnify',
      path: '/search',
      isLibraryNode: false,
    });
  }
  if (enabledItems.includes('artists')) {
    items.push({
      label: 'artists',
      icon: 'mdi-account-outline',
      path: '/artists',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('albums')) {
    items.push({
      label: 'albums',
      icon: 'mdi-album',
      path: '/albums',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('tracks')) {
    items.push({
      label: 'tracks',
      icon: 'mdi-music-note',
      path: '/tracks',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('playlists')) {
    items.push({
      label: 'playlists',
      icon: 'mdi-playlist-play',
      path: '/playlists',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('radios')) {
    items.push({
      label: 'radios',
      icon: 'mdi-access-point',
      path: '/radios',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('browse')) {
    items.push({
      label: 'browse',
      icon: 'mdi-folder-outline',
      path: '/browse',
      isLibraryNode: true,
    });
  }
  if (enabledItems.includes('settings')) {
    items.push({
      label: 'settings.settings',
      icon: 'mdi-cog-outline',
      path: '/settings',
      isLibraryNode: true,
    });
  }
  return items;
};
</script>

<style scoped>
.logo_text {
  margin-left: 0px;
  font-family: 'JetBrains Mono Medium';
  font-size: larger;
  font-weight: 500;
}

.logo_icon {
  margin-left: -8px;
  border-radius: 4px;
  width: 38px;
}

.v-list-item :deep(.v-list-item__prepend) {
  width: 55px;
}
</style>
