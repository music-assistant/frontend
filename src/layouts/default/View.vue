<template>
  <v-main
    id="cont"
    :class="['main-layout', { 'main-layout--mobile': store.mobileLayout }]"
  >
    <SidebarProvider>
      <AppSidebar />
      <SidebarInset>
        <div
          :class="[
            'content-section',
            { 'content-section--mobile': store.mobileLayout },
          ]"
        >
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
          <add-to-playlist-dialog />
          <create-playlist-dialog />
          <merge-genre-dialog />
          <delete-genre-dialog />
          <link-genre-dialog />
          <item-context-menu />
        </div>
      </SidebarInset>
    </SidebarProvider>
  </v-main>
</template>

<script lang="ts" setup>
import AppSidebar from "@/components/navigation/AppSidebar.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { store } from "@/plugins/store";
import DeleteGenreDialog from "@/components/genre/DeleteGenreDialog.vue";
import LinkGenreDialog from "@/components/genre/LinkGenreDialog.vue";
import MergeGenreDialog from "@/components/genre/MergeGenreDialog.vue";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import CreatePlaylistDialog from "./CreatePlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow: hidden;
  /* Reset Vuetify's automatic padding that accounts for drawers */
  padding-left: 0 !important;
  padding-right: 0 !important;
}

.content-section {
  flex: 1;
  overflow-y: auto;
  min-height: 0;
  padding-bottom: 90px;
}

.content-section--mobile {
  padding-bottom: 230px;
}
</style>
