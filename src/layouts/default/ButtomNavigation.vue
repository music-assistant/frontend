<template>
  <v-bottom-navigation color="primary" :active="getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' })" grow>
    <v-btn v-for="menuItem of menuItems" :key="menuItem.path" nav density="compact" :to="menuItem.path">
      <v-icon>{{ menuItem.icon }}</v-icon>
      <h6>{{ $t(menuItem.label) }}</h6>
    </v-btn>
  </v-bottom-navigation>
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
    label: 'library',
    icon: 'mdi-book',
  },
];

watch(
  () => store.showNavigationMenu,
  (isShown) => {
    isShown ? (store.sizeNavigationMenu = !getBreakpointValue('mobile') ? 200 : 250) : (store.sizeNavigationMenu = 55);
  },
);
</script>
