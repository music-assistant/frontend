<template>
  <v-bottom-navigation
    :height="height"
    grow
    elevation="15"
    style="border-top: 1px solid #20202035"
    role="navigation"
  >
    <!-- Full menu for larger screens -->
    <template v-if="getBreakpointValue('tablet')">
      <v-btn
        v-for="menuItem of menuItems"
        :key="menuItem.label"
        :to="menuItem.path"
        :aria-label="$t(menuItem.label)"
        tabindex="0"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-btn>
    </template>

    <!-- Compact menu for smaller screens -->
    <template v-else>
      <v-btn
        v-for="menuItem of menuItems.filter((x) => !x.isLibraryNode)"
        :key="menuItem.label"
        :to="menuItem.path"
        :aria-label="$t(menuItem.label)"
        tabindex="0"
      >
        <v-icon size="xx-large">{{ menuItem.icon }}</v-icon>
        <span class="menuButton">{{ $t(menuItem.label) }}</span>
      </v-btn>

      <v-menu>
        <template #activator="{ props }">
          <v-btn
            v-bind="props"
            aria-haspopup="true"
            :aria-expanded="isLibraryOpen.toString()"
            aria-label="Open library menu"
          >
            <v-icon size="xx-large">mdi-bookshelf</v-icon>
            <span class="menuButton">{{ $t("library") }}</span>
          </v-btn>
        </template>

        <v-list>
          <v-list-item
            v-for="menuItem of menuItems.filter((x) => x.isLibraryNode)"
            :key="menuItem.label"
            :title="$t(menuItem.label)"
            :prepend-icon="menuItem.icon"
            :to="menuItem.path"
          />
        </v-list>
      </v-menu>
    </template>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getMenuItems } from "./DrawerNavigation.vue";
import { getBreakpointValue } from "@/plugins/breakpoint";

export interface Props {
  height: number;
}
defineProps<Props>();

const menuItems = getMenuItems();

const isLibraryOpen = ref(false);
</script>

<style scoped>
.menuButton {
  font-weight: 350;
  font-size: x-small;
  font-stretch: condensed;
  text-transform: none;
  margin-top: 5px;
}

.v-btn--active {
  color: rgb(var(--v-theme-accent));
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>
