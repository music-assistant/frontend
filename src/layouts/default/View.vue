<template>
  <v-main id="cont" class="overflow-y-auto" style="height: 0px">
    <drawer-navigation
      v-if="store.navigationMenuStyle == 'vertical' && !store.frameless"
    />
    <router-view v-slot="{ Component }">
      <component :is="Component" />
    </router-view>
    <add-to-playlist-dialog />
    <item-context-menu />
    <v-snackbar
      :model-value="store.activeAlert !== undefined"
      :color="store.activeAlert?.type || 'grey'"
      :text="store.activeAlert?.message"
      close-on-content-click
      position="sticky"
      :timeout="store.activeAlert?.persistent ? -1 : 5000"
      z-index="999999"
      style="z-index: 999999"
      @update:model-value="() => (store.activeAlert = undefined)"
    />
  </v-main>
</template>

<script lang="ts" setup>
import DrawerNavigation from "./DrawerNavigation.vue";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
import { store } from "@/plugins/store";
</script>
