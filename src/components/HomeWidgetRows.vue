<template>
  <div v-for="widgetRow in widgetRows" :key="widgetRow.label">
    <HomeWidgetRow :widget-row="widgetRow" />
  </div>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import HomeWidgetRow, { WidgetRow } from '@/components/HomeWidgetRow.vue';
import { ref } from 'vue';
import { onActivated } from 'vue';

const widgetRows = ref<Record<string, WidgetRow>>({
  recently_played: {
    label: 'recently_played',
    icon: 'mdi-motion-play',
    items: [],
  },
  artists: {
    label: 'artists',
    icon: 'mdi-account-music',
    path: '/artists',
    items: [],
  },
  albums: {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
    items: [],
  },
  playlists: {
    label: 'playlists',
    icon: 'mdi-playlist-music',
    path: '/playlists',
    items: [],
  },
  tracks: {
    label: 'tracks',
    icon: 'mdi-file-music',
    path: '/tracks',
    items: [],
  },
  radios: {
    label: 'radios',
    icon: 'mdi-radio',
    path: '/radios',
    items: [],
  },
  browse: {
    label: 'browse',
    icon: 'mdi-folder',
    path: '/browse',
    items: [],
  },
});

onActivated(async () => {
  // recently played widget row
  widgetRows.value.recently_played.items = await api.getRecentlyPlayedItems(10);

  // library artists widget row
  // TODO: Find a way to make the images for this row eager load
  const artistItems = await api.getLibraryArtists(
    undefined,
    undefined,
    20,
    undefined,
    'RANDOM()',
  );
  widgetRows.value.artists.items = artistItems.items;
  widgetRows.value.artists.count = artistItems.total;

  // library albums widget row
  // TODO: Find a way to make the images for this row eager load
  const albumItems = await api.getLibraryAlbums(
    undefined,
    undefined,
    20,
    undefined,
    'timestamp_added DESC',
  );
  widgetRows.value.albums.items = albumItems.items;
  widgetRows.value.albums.count = albumItems.total;

  // library playlist widget row
  const playlistItems = await api.getLibraryPlaylists(
    undefined,
    undefined,
    20,
    undefined,
    'timestamp_added DESC',
  );
  widgetRows.value.playlists.items = playlistItems.items;
  widgetRows.value.playlists.count = playlistItems.total;

  // library radios widget row
  const radioItems = await api.getLibraryRadios(
    undefined,
    undefined,
    20,
    undefined,
    'timestamp_added DESC',
  );
  widgetRows.value.radios.items = radioItems.items;
  widgetRows.value.radios.count = radioItems.total;

  // tracks widget
  const trackItems = await api.getLibraryTracks(
    undefined,
    undefined,
    20,
    undefined,
    'timestamp_added DESC',
  );
  widgetRows.value.tracks.items = trackItems.items;
  widgetRows.value.tracks.count = trackItems.total;
});

// });
</script>

<style></style>
