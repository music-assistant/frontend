<template>
  <div>

    <div v-for="widgetRow in widgetRows">
      <v-divider />
      <div v-if="widgetRow.items.length" class="widget-row">
      <v-toolbar color="transparent" @click="widgetRow.path ? $router.replace(widgetRow.path) : ''" style="cursor: pointer">
        <template #prepend><v-icon :icon="widgetRow.icon" style="margin-left: 15px" /></template>
        <template #title>{{ $t(widgetRow.label) }}</template>
        <template #append v-if="widgetRow.path"><v-badge
          v-if="widgetRow.count"
          color="grey"
          :content="widgetRow.count"
          inline
        /></template>
      </v-toolbar>
      <v-slide-group :show-arrows="false">
        <v-slide-group-item v-for="item in widgetRow.items" :key="item.uri">
          <PanelviewItem :item="item" :show-checkboxes="false" :show-track-number="false" :is-selected="false" style="height:160px;width:120px" />
        </v-slide-group-item>
        <template #prev></template>
        <template #next></template>
      </v-slide-group>
    </div>
    </div>

  </div>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import { Artist, MediaItemType, PagedItems } from '@/plugins/api/interfaces';
import PanelviewItem from '@/components/PanelviewItem.vue';
import { onMounted, ref } from 'vue';



interface WidgetRow {
  label: string;
    icon: string;
    path?: string;
    items: MediaItemType[],
    count?: number;
}

const widgetRows = ref<Record<string, WidgetRow>>({
  artists: {
    label: 'artists',
    icon: 'mdi-account-music',
    path: '/artists',
    items: []
  },
  albums: {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
    items: []
  },
  playlists: {
    label: 'playlists',
    icon: 'mdi-playlist-music',
    path: '/playlists',
    items: []
  },
  tracks: {
    label: 'tracks',
    icon: 'mdi-file-music',
    path: '/tracks',
    items: []
  },
  radios: {
    label: 'radios',
    icon: 'mdi-radio',
    path: '/radios',
    items: []
  },
  browse: {
    label: 'browse',
    icon: 'mdi-folder',
    path: '/browse',
    items: []
  },
  
});

onMounted(() => {

  api.getLibraryArtists(undefined, undefined, 10, undefined, "timestamp_added DESC").then(pagedItems => {
    widgetRows.value.artists.items = pagedItems.items;
    widgetRows.value.artists.count = pagedItems.total;
  })
  api.getLibraryAlbums(undefined, undefined, 10, undefined, "timestamp_added DESC").then(pagedItems => {
    widgetRows.value.albums.items = pagedItems.items;
    widgetRows.value.albums.count = pagedItems.total;
  })
  api.getLibraryPlaylists(undefined, undefined, 10, undefined, "timestamp_added DESC").then(pagedItems => {
    widgetRows.value.playlists.items = pagedItems.items;
    widgetRows.value.playlists.count = pagedItems.total;
  })
  api.getLibraryTracks(undefined, undefined, 10, undefined, "timestamp_added DESC").then(pagedItems => {
    widgetRows.value.tracks.items = pagedItems.items;
    widgetRows.value.tracks.count = pagedItems.total;
  })
  api.getLibraryRadios(undefined, undefined, 10, undefined, "timestamp_added DESC").then(pagedItems => {
    widgetRows.value.radios.items = pagedItems.items;
    widgetRows.value.radios.count = pagedItems.total;
  })
  api.browse().then(browseFolder => {
    widgetRows.value.browse.items = browseFolder.items!;
  })

});


</script>

<style>
.home-card {
  min-width: 80px;
  text-align: center;
  padding-top: 12px;
  padding-bottom: 8px;
}

.widget-row {
  margin-bottom: 20px;
}

.v-slide-group__prev {
  min-width: 0px !important;
  margin-right: -15px;
}
.v-slide-group__next {
  min-width: 0px !important;
}

</style>
