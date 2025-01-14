<template>
  <div v-for="widgetRow in widgetRows" :key="widgetRow.label">
    <HomeWidgetRow :widget-row="widgetRow" />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { store } from "@/plugins/store";
import HomeWidgetRow, { WidgetRow } from "@/components/HomeWidgetRow.vue";
import { ref } from "vue";
import { onActivated } from "vue";

const widgetRows = ref<Record<string, WidgetRow>>({
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
</script>

<style></style>
