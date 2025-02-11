<template>
  <div v-for="widgetRow in widgetRows" :key="widgetRow.label">
    <HomeWidgetRow v-if="widgetRow.items.length" :widget-row="widgetRow" />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import HomeWidgetRow, { WidgetRow } from "@/components/HomeWidgetRow.vue";
import { onBeforeUnmount, onMounted, ref } from "vue";
import { onActivated } from "vue";
import { EventMessage, EventType } from "@/plugins/api/interfaces";

const widgetRows = ref<Record<string, WidgetRow>>({
  in_progress_items: {
    label: "in_progress_items",
    icon: "mdi-motion-play",
    items: [],
  },
  recently_played: {
    label: "recently_played",
    icon: "mdi-motion-play",
    items: [],
  },
  artists: {
    label: "artists",
    icon: "mdi-account-music",
    path: "/artists",
    items: [],
  },
  albums: {
    label: "albums",
    icon: "mdi-album",
    path: "/albums",
    items: [],
  },
  playlists: {
    label: "playlists",
    icon: "mdi-playlist-music",
    path: "/playlists",
    items: [],
  },
  tracks: {
    label: "tracks",
    icon: "mdi-file-music",
    path: "/tracks",
    items: [],
  },
  radios: {
    label: "radios",
    icon: "mdi-radio",
    path: "/radios",
    items: [],
  },
  browse: {
    label: "browse",
    icon: "mdi-folder",
    path: "/browse",
    items: [],
  },
});

const loadData = async function () {
  // recently played widget row
  widgetRows.value.recently_played.items = await api.getRecentlyPlayedItems(10);

  // in-progress audiobooks/episodes widget row
  widgetRows.value.in_progress_items.items = await api.getInProgressItems(10);

  // library artists widget row
  // TODO: Find a way to make the images for this row eager load
  widgetRows.value.artists.items = await api.getLibraryArtists(
    undefined,
    undefined,
    20,
    undefined,
    "random",
  );
  widgetRows.value.artists.count = store.libraryArtistsCount;

  // library albums widget row
  // TODO: Find a way to make the images for this row eager load

  widgetRows.value.albums.items = await api.getLibraryAlbums(
    undefined,
    undefined,
    20,
    undefined,
    "timestamp_added_desc",
  );
  widgetRows.value.albums.count = store.libraryAlbumsCount;

  // library playlist widget row
  widgetRows.value.playlists.items = await api.getLibraryPlaylists(
    undefined,
    undefined,
    20,
    undefined,
    "timestamp_added_desc",
  );
  widgetRows.value.playlists.count = store.libraryPlaylistsCount;

  // library radios widget row
  widgetRows.value.radios.items = await api.getLibraryRadios(
    undefined,
    undefined,
    20,
    undefined,
    "timestamp_added_desc",
  );
  widgetRows.value.radios.count = store.libraryRadiosCount;

  // tracks widget
  widgetRows.value.tracks.items = await api.getLibraryTracks(
    undefined,
    undefined,
    20,
    undefined,
    "timestamp_added_desc",
  );
  widgetRows.value.tracks.count = store.libraryTracksCount;

  // tracks widget
  widgetRows.value.browse.items = await api.browse();
};

await loadData();

onActivated(() => {
  // update the listing when a cached view is reactivated
  loadData();
});

onMounted(() => {
  // signal if/when an item gets played (or is playing)
  const unsub = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    async (evt: EventMessage) => {
      // update the recently played and in-progress widget rows
      widgetRows.value.recently_played.items =
        await api.getRecentlyPlayedItems(10);
      widgetRows.value.in_progress_items.items =
        await api.getInProgressItems(10);
    },
  );
  onBeforeUnmount(unsub);
});
</script>

<style></style>
