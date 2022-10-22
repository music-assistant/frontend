<template>
  <div
    v-if="$vuetify.display.width < getResponsiveBreakpoints.breakpoint_1"
    style="padding-top: 10px; width: 100%"
  >
    <v-tabs show-arrows stacked centered style="width: 100%; height: auto">
      <v-tab
        v-for="tab in tabs"
        :key="tab.label"
        :to="tab.path"
        style="height: fit-content"
        :value="tab.label"
      >
        <v-icon :icon="tab.icon" />
        <v-list-item-subtitle>
          {{ $t(tab.label) }}
        </v-list-item-subtitle>
      </v-tab>
    </v-tabs>
  </div>
</template>

<script setup lang="ts">
import { getResponsiveBreakpoints } from '@/utils';
import {
  mdiHome,
  mdiAccountMusic,
  mdiAlbum,
  mdiFileMusic,
  mdiPlaylistMusic,
  mdiRadio,
  mdiFolder,
} from '@mdi/js';
import { ref } from 'vue';

const tabs = ref([
  {
    label: 'home',
    icon: mdiHome,
    path: '/',
  },
  {
    label: 'artists',
    icon: mdiAccountMusic,
    path: '/artists',
  },
  {
    label: 'albums',
    icon: mdiAlbum,
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: mdiFileMusic,
    path: '/tracks',
  },
  {
    label: 'playlists',
    icon: mdiPlaylistMusic,
    path: '/playlists',
  },
  {
    label: 'radios',
    icon: mdiRadio,
    path: '/radios',
  },
  {
    label: 'browse',
    icon: mdiFolder,
    path: '/browse',
  },
]);
</script>
