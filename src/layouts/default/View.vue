<template>
  <v-main id="cont" class="main-layout">
    <Navigation v-if="!store.mobileLayout" class="nav-section" />
    <div class="content-section">
      <router-view v-slot="{ Component }">
        <component :is="Component" />
      </router-view>
      <add-to-playlist-dialog />
      <item-context-menu />
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
