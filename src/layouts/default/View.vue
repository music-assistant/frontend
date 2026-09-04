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
            { 'party-view-active': route.meta.partyView === true },
          ]"
        >
          <router-view v-slot="{ Component }">
            <component :is="Component" />
          </router-view>
          <add-to-playlist-dialog />
          <audio-overlay-dialog />
          <create-playlist-dialog />
          <create-smart-playlist-dialog />
          <import-playlist-dialog />
          <migrate-playlist-dialog />
          <play-announcement-dialog />
          <merge-genre-dialog />
          <delete-genre-dialog />
          <link-genre-dialog />
          <dialog-delete-confirmation />
          <player-group-playback-dialog />
          <setup-flow-dialog />
          <player-rename-dialog />
          <item-context-menu />
          <command-center />
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
import AddManualLink from "@/components/AddManualLink.vue";
import CommandCenter from "@/components/CommandCenter.vue";
import DialogDeleteConfirmation from "@/components/DialogDeleteConfirmation.vue";
import DeleteGenreDialog from "@/components/genre/DeleteGenreDialog.vue";
import LinkGenreDialog from "@/components/genre/LinkGenreDialog.vue";
import MergeGenreDialog from "@/components/genre/MergeGenreDialog.vue";
import AppSidebar from "@/components/navigation/AppSidebar.vue";
import PlayerRenameDialog from "@/components/PlayerRenameDialog.vue";
import PlayerGroupPlaybackDialog from "@/components/PlayerGroupPlaybackDialog.vue";
import SetupFlowDialog from "@/components/SetupFlowDialog.vue";
import { SidebarInset, SidebarProvider } from "@/components/ui/sidebar";
import {
  MediaType,
  type Playlist,
  type Radio,
  type Track,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { useRoute } from "vue-router";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import AudioOverlayDialog from "./AudioOverlayDialog.vue";
import CreatePlaylistDialog from "./CreatePlaylistDialog.vue";
import CreateSmartPlaylistDialog from "./CreateSmartPlaylistDialog.vue";
import ImportPlaylistDialog from "./ImportPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";
import MigratePlaylistDialog from "./MigratePlaylistDialog.vue";
import PlayAnnouncementDialog from "./PlayAnnouncementDialog.vue";
import PlayerSelect from "./PlayerSelect.vue";

const route = useRoute();

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
  box-sizing: border-box;
  display: flex;
  height: 100vh;
  height: 100dvh;
  overflow: hidden;
  /* Reset Vuetify's automatic padding that accounts for drawers */
  padding-top: var(--device-inset-top) !important;
  padding-right: var(--device-inset-right) !important;
  padding-left: var(--device-inset-left) !important;
}

.content-section {
  flex: 1;
  overflow-y: auto;
  overflow-x: hidden;
  min-height: 0;
  padding-bottom: calc(110px + var(--device-inset-bottom));
}

.content-section--mobile {
  /* clears the bottom navigation plus the floating player bar above it */
  padding-bottom: calc(var(--mobile-navigation-height) + 162px);
}

.content-section--frameless {
  padding-bottom: 0;
}
</style>
