<template>
  <v-navigation-drawer
        app
        :permanent="!$vuetify.display.mobile"
        :rail="!$vuetify.display.mobile && !store.showNavigationMenu"
        :model-value="($vuetify.display.mobile && store.showNavigationMenu) || !$vuetify.display.mobile"
        @update:model-value="(e) => { if ($vuetify.display.mobile)store.showNavigationMenu = e}"
        :width="220"
      >
        <div style="height:20px"></div>
        <v-list lines="one" density="compact" nav>
          <v-list-item nav  density="compact" :height="15"
            v-for="menuItem of menuItems"
            :key="menuItem.path"
            :title="$t(menuItem.label)"
            :prepend-icon="menuItem.icon"
            :to="menuItem.path"
          />
        </v-list>
      </v-navigation-drawer>
</template>

<script setup lang="ts">
import { store } from "@/plugins/store";

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
]

</script>

<style>

</style>
