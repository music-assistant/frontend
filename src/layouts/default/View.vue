<template>
  <v-main
    id="cont"
    :class="['main-layout', { 'main-layout--mobile': store.mobileLayout }]"
  >
    <Navigation v-if="!store.mobileLayout" class="nav-section" />
    <div class="content-section">
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
    </div>
  </v-main>
</template>

<script lang="ts" setup>
import Navigation from "@/components/navigation/Navigation.vue";
import { store } from "@/plugins/store";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow-y: auto;
}

.main-layout--mobile {
  padding-bottom: 230px;
}

.nav-section {
  flex: 0 0 auto;
  width: 290px;
  transition: width 0.3s ease;
}
.content-section {
  flex: 1;
  overflow-y: auto;
  height: 100%;
}
</style>
