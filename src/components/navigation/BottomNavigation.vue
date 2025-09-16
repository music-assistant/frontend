<template>
  <v-bottom-navigation
    :height="height"
    bg-color="default"
    grow
    role="navigation"
  >
    <v-btn
      v-for="menuItem of menuItems.filter((x) => !x.isLibraryNode)"
      :key="menuItem.label"
      :to="menuItem.path"
      :aria-label="$t(menuItem.label)"
      tabindex="0"
      variant="text"
      active-color="fg"
      base-color="grey"
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
          base-color="grey"
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
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { getMenuItems } from "./utils/getMenuItems";

export interface Props {
  height: number;
}
defineProps<Props>();

const menuItems = getMenuItems();

const isLibraryOpen = ref(false);
</script>

<style>
.menuButton {
  font-weight: 350;
  font-size: x-small;
  font-stretch: condensed;
  text-transform: none;
  margin-top: 5px;
}

.v-btn--active > .v-btn__overlay {
  background: rgb(var(--v-theme-default)) !important;
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>
