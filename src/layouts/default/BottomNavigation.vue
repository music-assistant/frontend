<template>
  <v-bottom-navigation height="80" grow>
    <!-- full menu -->
    <v-tabs
      v-if="getBreakpointValue('tablet')"
      stacked
      grow
      :show-arrows="false"
      :model-value="activeTab"
      nav
      color="accent"
    >
      <v-tab
        v-for="menuItem of menuItems"
        :key="menuItem.path"
        :to="menuItem.path"
        :value="menuItem.path"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-tab>
    </v-tabs>
    <!-- compact menu -->
    <v-tabs
      v-else
      stacked
      grow
      :show-arrows="false"
      :model-value="activeTab"
      nav
      color="accent"
    >
      <v-tab
        v-for="menuItem of menuItems.filter((x) => !x.isLibraryNode)"
        :key="menuItem.path"
        :to="menuItem.path"
        :value="menuItem.path"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-tab>

      <v-menu>
        <template #activator="{ props }">
          <v-tab key="library" v-bind="props">
            <v-icon size="xx-large">mdi-bookshelf</v-icon>
            <span class="menuButton">{{ $t('library') }}</span>
          </v-tab>
        </template>

        <v-list class="bg-grey-lighten-3">
          <v-list-item
            v-for="menuItem of menuItems.filter((x) => x.isLibraryNode)"
            :key="menuItem.path"
            :title="$t(menuItem.label)"
            :prepend-icon="menuItem.icon"
            :to="menuItem.path"
          />
        </v-list>
      </v-menu>
    </v-tabs>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import router from '@/plugins/router';
import { getMenuItems } from './DrawerNavigation.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';

export interface Props {
  height: number;
}
defineProps<Props>();

const menuItems = getMenuItems();

const activeTab = computed(() => {
  for (const menuItem of menuItems) {
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
