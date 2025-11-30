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
      <GenreDialog v-model="showGenreDialog" :genre="editingGenre" />
      <MergeGenreDialog
        v-model="showMergeGenreDialog"
        :source-genres="mergeSourceGenres"
      />
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
import GenreDialog from "@/components/GenreDialog.vue";
import MergeGenreDialog from "@/components/MergeGenreDialog.vue";
import Navigation from "@/components/navigation/Navigation.vue";
import type { Genre } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref } from "vue";
import AddToPlaylistDialog from "./AddToPlaylistDialog.vue";
import ItemContextMenu from "./ItemContextMenu.vue";

const showGenreDialog = ref(false);
const editingGenre = ref<Genre | undefined>(undefined);
const showMergeGenreDialog = ref(false);
const mergeSourceGenres = ref<Genre[]>([]);

onMounted(() => {
  eventbus.on("editGenre", (genre: any) => {
    editingGenre.value = genre;
    showGenreDialog.value = true;
  });
  eventbus.on("mergeGenres", (genres: any) => {
    mergeSourceGenres.value = genres;
    showMergeGenreDialog.value = true;
  });
});

onBeforeUnmount(() => {
  eventbus.off("editGenre");
  eventbus.off("mergeGenres");
});
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
