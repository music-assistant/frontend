<template>
  <div
    v-if="$vuetify.display.width < getResponsiveBreakpoints.breakpoint_1"
    style="padding-top: 10px; width: 100%"
  >
    <v-tabs
      grow
      show-arrows
      stacked
      optional
      align-tabs="center"
      style="width: 100%; height: auto"
    >
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
import { mdiHome, mdiMagnify, mdiCogOutline } from '@mdi/js';
import { onMounted, ref } from 'vue';

const tabs = ref([
  {
    label: 'home',
    icon: mdiHome,
    path: '/',
  },
  {
    label: 'search',
    icon: mdiMagnify,
    path: '/search',
  },
  {
    label: 'settings',
    icon: mdiCogOutline,
    path: '/settings',
  },
]);
</script>
