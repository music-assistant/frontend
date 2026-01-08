<!--
  Global dialog to add item(s) to a playlist.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-dialog
    v-model="show"
    fullscreen
    transition="dialog-bottom-transition"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card>
      <Toolbar
        icon="mdi-playlist-plus"
        :title="$t('add_playlist')"
        :menu-items="[
          {
            label: 'close',
            icon: 'mdi-close',
            action: close,
          },
        ]"
      />

      <v-divider />
      <br />

      <v-list>
        <div v-for="playlist of playlists" :key="playlist.item_id">
          <v-list-item @click="addToPlaylist(playlist)">
            <template #prepend>
              <div class="media-thumb">
                <MediaItemThumb :item="playlist" :size="50" />
              </div>
            </template>
            <template #title>
              <div>{{ playlist.name }}</div>
            </template>
            <template #subtitle>
              <div>{{ playlist.owner }}</div>
            </template>
            <template #append>
              <provider-icon
                v-if="playlist.provider_mappings"
                :domain="playlist.provider_mappings[0].provider_domain"
                :size="20"
              />
            </template>
          </v-list-item>
        </div>
        <!-- a bit of spacing, followed by add playlist items-->
        <div style="height: 30px"></div>
        <v-divider />
        <div style="height: 30px"></div>
        <!-- create playlist row(s) -->
        <div v-for="providerId of createPlaylistProviders" :key="providerId">
          <v-list-item @click="newPlaylist(providerId)">
            <template #prepend>
              <div style="margin-left: -10px; padding-right: 5px">
                <provider-icon
                  :domain="api.providers[providerId].domain"
                  :size="50"
                />
              </div>
            </template>
            <template #title>
              <div>{{ $t("new_playlist") }}</div>
            </template>
            <template #subtitle>
              <div>
                {{ $t("create_playlist_on", [api.providers[providerId].name]) }}
              </div>
            </template>
            <template #append>
              <provider-icon
                :domain="api.providers[providerId].domain"
                :size="20"
              />
            </template>
          </v-list-item>
        </div>
      </v-list>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import Toolbar from "@/components/Toolbar.vue";
import api from "@/plugins/api";
import type {
  MediaItemType,
  MediaItemTypeOrItemMapping,
  Playlist,
} from "@/plugins/api/interfaces";
import { MediaType, ProviderFeature } from "@/plugins/api/interfaces";
import { eventbus, PlaylistDialogEvent } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { toast } from "vuetify-sonner";

const show = ref<boolean>(false);
const playlists = ref<Playlist[]>([]);
const createPlaylistProviders = ref<string[]>([]);
const parentItem = ref<MediaItemType>();
const selectedItems = ref<MediaItemTypeOrItemMapping[]>([]);

onMounted(() => {
  eventbus.on("playlistdialog", async (evt: PlaylistDialogEvent) => {
    show.value = true;
    selectedItems.value = evt.items;
    parentItem.value = evt.parentItem;
    await fetchPlaylists();
  });
  onBeforeUnmount(() => {
    eventbus.off("playlistdialog");
  });
});

const fetchPlaylists = async function () {
  // get all (editable) playlists that are suitable as target
  playlists.value = [];
  createPlaylistProviders.value = [];
  const playlistResults = await api.getLibraryPlaylists();
  let refItem = selectedItems.value.length ? selectedItems.value[0] : undefined;

  if (!refItem) return;

  // For folders, backend handles expansion, so they're compatible with any playlist
  const isFolder = refItem.media_type === MediaType.FOLDER;

  if (!isFolder && !("provider_mappings" in refItem)) {
    // resolve itemmapping
    refItem = await api.getItem(
      refItem.media_type,
      refItem.item_id,
      refItem.provider,
    );
  }

  for (const playlist of playlistResults) {
    // skip unavailable playlists
    if (!playlist.provider_mappings.filter((x) => x.available).length) continue;
    // skip non-editable playlists
    if (!playlist.is_editable) continue;
    // skip playlist that is currently opened (=parentItem)
    if (
      parentItem.value &&
      parentItem.value.media_type === MediaType.PLAYLIST &&
      playlist.item_id === parentItem.value.item_id
    )
      continue;

    const playListProvider =
      api.providers[playlist.provider_mappings[0].provider_instance];

    // Folders are compatible with any builtin/streaming provider playlist
    // For other media types, check for provider match
    if (
      playListProvider &&
      (playListProvider.domain == "builtin" ||
        playListProvider.is_streaming_provider ||
        (!isFolder &&
          "provider_mappings" in refItem &&
          refItem.provider_mappings.filter(
            (x) => x.provider_instance == playListProvider.instance_id,
          ).length))
    ) {
      playlists.value.push(playlist);
    }
  }
  // determine which providers may be used to create a new playlist
  for (const provider of Object.values(api.providers)) {
    if (!provider.supported_features.includes(ProviderFeature.PLAYLIST_CREATE))
      continue;
    if (
      !provider.supported_features.includes(
        ProviderFeature.PLAYLIST_TRACKS_EDIT,
      )
    )
      continue;
    // Folders are compatible with any builtin/streaming provider
    // For other media types, check for provider match
    if (
      provider.domain == "builtin" ||
      provider.is_streaming_provider ||
      (!isFolder &&
        "provider_mappings" in refItem &&
        refItem.provider_mappings.filter(
          (x) => x.provider_instance == provider.instance_id,
        ).length)
    ) {
      createPlaylistProviders.value.push(provider.instance_id);
    }
  }
};
const addToPlaylist = async function (value: MediaItemType) {
  /// add item(s) to playlist
  api.addPlaylistTracks(
    value.item_id,
    selectedItems.value.map((x) => x.uri),
  );
  close();
  toast.info($t("background_task_added"));
};
const newPlaylist = async function (provId: string) {
  const name = prompt($t("new_playlist_name"));
  if (!name) return;
  const newPlaylist = await api.createPlaylist(name, provId);
  addToPlaylist(newPlaylist);
};

const close = function () {
  show.value = false;
};
</script>

<style scoped>
.media-thumb {
  padding-right: 15px;
}
</style>
