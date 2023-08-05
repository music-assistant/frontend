<template>
  <v-bottom-navigation height="80" grow>
    <v-tabs stacked :show-arrows="false" :model-value="activeTab" center-active nav color="accent">
      <v-tab v-for="menuItem of mainMenuItems" :key="menuItem.path" :to="menuItem.path" :value="menuItem.path">
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-tab>
    </v-tabs>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import { mainMenuItems } from './DrawerNavigation.vue';
import router from '@/plugins/router';

export interface Props {
  height: number;
}
defineProps<Props>();

const activeTab = computed(() => {
  for (const menuItem of mainMenuItems) {
    if (router.currentRoute.value.path.startsWith(menuItem.path)) {
      return menuItem.path;
    }
  }
  return '';
});
</script>

<style>
.menuButton {
  font-weight: 300;
  font-size: x-small;
  font-stretch: condensed;
  text-transform: none;
  margin-top: 5px;
}
.v-slide-group-item--active {
  opacity: 100%;
}
</style>
