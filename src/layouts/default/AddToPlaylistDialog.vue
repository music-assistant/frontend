<!--
  Global dialog to add item(s) to a playlist.
  Because this dialog can be called from various places throughout the app,
  we steer its visibility through the centralized eventbus.
-->
<template>
  <v-dialog
    v-model="show"
    :fullscreen="$vuetify.display.mobile"
    min-height="80%"
    :scrim="true"
    @update:model-value="
      (v) => {
        store.dialogActive = v;
      }
    "
  >
    <v-card>
      <v-toolbar
        color="transparent"
        style="padding: 10px 0px"
        density="compact"
        class="titlebar"
      >
        <v-btn icon="mdi-play-circle-outline" />
        <v-toolbar-title style="padding-left: 10px">
          <b>{{ $t('add_playlist') }}</b>
        </v-toolbar-title>
        <v-btn icon="mdi-close" dark @click="close()" />
      </v-toolbar>
      <v-divider />

      <v-card-text>
        <v-list>
          <div v-for="playlist of playlists" :key="playlist.item_id">
            <ListItem ripple density="default" @click="addToPlaylist(playlist)">
              <template #prepend>
                <div class="media-thumb">
                  <MediaItemThumb
                    :item="playlist"
                    :size="50"
                    width="50px"
                    height="50px"
                  />
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
            </ListItem>
          </div>
          <!-- create playlist row(s) -->
          <div v-for="prov of api.providers" :key="prov.instance_id">
            <div
              v-if="
                prov.supported_features.includes(
                  ProviderFeature.PLAYLIST_CREATE,
                )
              "
            >
              <ListItem ripple>
                <template #prepend>
                  <provider-icon
                    :domain="prov.domain"
                    :size="40"
                    class="media-thumb"
                  />
                </template>
                <template #title>
                  <v-text-field
                    :label="$t('create_playlist', [prov.name])"
                    append-icon="mdi-playlist-plus"
                    variant="plain"
                    hide-details
                    @update:model-value="
                      (txt) => {
                        newPlaylistName = txt;
                      }
                    "
                    @click:append="newPlaylist(prov.instance_id)"
                    @keydown.enter="newPlaylist(prov.instance_id)"
                  />
                </template>
              </ListItem>
            </div>
          </div>
        </v-list>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { MediaType } from '@/plugins/api/interfaces';
import type { MediaItemType, Playlist } from '@/plugins/api/interfaces';
import { onBeforeUnmount, onMounted, ref } from 'vue';
import { ProviderFeature } from '@/plugins/api/interfaces';
import api from '@/plugins/api';
import { store } from '@/plugins/store';
import { eventbus, PlaylistDialogEvent } from '@/plugins/eventbus';
import ListItem from '@/components/mods/ListItem.vue';

const show = ref<boolean>(false);
const playlists = ref<Playlist[]>([]);
const newPlaylistName = ref('');
const parentItem = ref<MediaItemType>();
const selectedItems = ref<MediaItemType[]>([]);

onMounted(() => {
  eventbus.on('playlistdialog', async (evt: PlaylistDialogEvent) => {
    await fetchPlaylists();
    selectedItems.value = evt.items;
    parentItem.value = evt.parentItem;
    show.value = true;
  });
  onBeforeUnmount(() => {
    eventbus.off('playlistdialog');
  });
});

const fetchPlaylists = async function () {
  // get all editable playlists
  playlists.value = [];
  const playlistResults = await api.getLibraryPlaylists();

  for (const playlist of playlistResults.items as Playlist[]) {
    if (
      playlist.is_editable &&
      !(
        parentItem.value &&
        parentItem.value.media_type === MediaType.PLAYLIST &&
        playlist.item_id === parentItem.value.item_id
      )
    ) {
      playlists.value.push(playlist as Playlist);
    }
  }
};
const addToPlaylist = function (value: MediaItemType) {
  /// add track(s) to playlist
  api.addPlaylistTracks(
    value.item_id,
    selectedItems.value.map((x) => x.uri),
  );
  close();
};
const newPlaylist = async function (provId: string) {
  const newPlaylist = await api.createPlaylist(newPlaylistName.value, provId);
  addToPlaylist(newPlaylist);
};

const close = function () {
  show.value = false;
};
</script>

<style>
.fullscreen-menu .v-overlay__content {
  left: 0px;
  right: 0px;
  top: 0px;
  bottom: 0px;
}
</style>
