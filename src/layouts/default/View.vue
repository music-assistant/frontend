<template>
  <v-main
    id="cont"
    :class="['main-layout', { 'main-layout--mobile': store.mobileLayout }]"
  >
    <SidebarProvider>
      <AppSidebar v-if="!store.frameless" />
      <SidebarInset>
        <div
          :class="[
            'content-section',
            { 'content-section--mobile': store.mobileLayout },
            { 'content-section--frameless': store.frameless },
          ]"
        >
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
          <add-to-playlist-dialog />
          <create-playlist-dialog />
          <import-playlist-dialog />
          <merge-genre-dialog />
          <delete-genre-dialog />
          <link-genre-dialog />
          <item-context-menu />
          <AddManualLink
            v-model="showEditItemDialog"
            :type="editItemType"
            :edit-item="editItem"
          />
        </div>
      </SidebarInset>
      <PlayerSelect />
    </SidebarProvider>
  </v-main>
</template>

<script lang="ts" setup>
import AppSidebar from "@/components/navigation/AppSidebar.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import { store } from "@/plugins/store";
import PlayerSelect from "./PlayerSelect.vue";
import DeleteGenreDialog from "@/components/genre/DeleteGenreDialog.vue";
import LinkGenreDialog from "@/components/genre/LinkGenreDialog.vue";
import MergeGenreDialog from "@/components/genre/MergeGenreDialog.vue";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import CreatePlaylistDialog from "./CreatePlaylistDialog.vue";
import ImportPlaylistDialog from "./ImportPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
import AddManualLink from "@/components/AddManualLink.vue";
import {
  MediaType,
  type Playlist,
  type Radio,
  type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { onBeforeUnmount, onMounted, ref } from "vue";

const showEditItemDialog = ref(false);
const editItem = ref<Radio | Track | Playlist | undefined>(undefined);
const editItemType = ref<MediaType>(MediaType.RADIO);

onMounted(() => {
  eventbus.on("editItemDialog", (item: Radio | Track | Playlist) => {
    editItem.value = item;
    editItemType.value = item.media_type as MediaType;
    showEditItemDialog.value = true;
  });
  onBeforeUnmount(() => {
    eventbus.off("editItemDialog");
  });
});
</script>

<style scoped>
.main-layout {
  display: flex;
  height: 100vh;
  height: 100dvh;
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

.content-section--frameless {
  padding-bottom: 0;
}
</style>
