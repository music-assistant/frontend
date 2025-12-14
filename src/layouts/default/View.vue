<template>
  <v-main
    id="cont"
    :class="['main-layout', { 'main-layout--mobile': store.mobileLayout }]"
  >
    <SidebarProvider>
      <AppSidebar v-if="!store.mobileLayout" />
      <SidebarInset>
        <div class="content-section">
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
          <add-to-playlist-dialog />
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
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  overflow-x: hidden;
  overflow-y: auto;
  /* Reset Vuetify's automatic padding that accounts for drawers */
  padding-left: 0 !important;
  padding-right: 0 !important;
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
