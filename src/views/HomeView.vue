<template>
  <div>
    <div v-for="widgetRow in widgetRows" :key="widgetRow.label">
      <v-divider />
      <div v-if="widgetRow.items.length" class="widget-row">
        <v-toolbar
          color="transparent"
          :style="widgetRow.path ? 'cursor: pointer' : ''"
          @click="widgetRow.path ? $router.replace(widgetRow.path) : ''"
        >
          <template #prepend><v-icon :icon="widgetRow.icon" style="margin-left: 15px" /></template>
          <template #title>
            <v-badge inline v-if="widgetRow.count" color="grey" :content="widgetRow.count">
              <span class="mr-3">{{ $t(widgetRow.label) }}</span>
            </v-badge>
          </template>
        </v-toolbar>
        <v-slide-group :show-arrows="false">
          <v-slide-group-item v-for="item in widgetRow.items" :key="item.uri">
            <PanelviewItem
              :item="item"
              :show-checkboxes="false"
              :show-track-number="false"
              :is-selected="false"
              style="height: 160px; width: 120px; margin: 5px"
              @click="itemClicked"
            />
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
import { BrowseFolder, MediaItemType, MediaType } from '@/plugins/api/interfaces';
import PanelviewItem from '@/components/PanelviewItem.vue';
import { onMounted, ref } from 'vue';
import { eventbus } from '@/plugins/eventbus';
import { itemIsAvailable } from '@/helpers/contextmenu';
import router from '@/plugins/router';

interface WidgetRow {
  label: string;
  icon: string;
  path?: string;
  items: MediaItemType[];
  count?: number;
}

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

onMounted(async () => {
  api.getRecentlyPlayedItems(20).then((items) => {
    widgetRows.value.recently_played.items = items;
  });
  api.getLibraryArtists(undefined, undefined, 20, undefined, 'RANDOM()').then((pagedItems) => {
    widgetRows.value.artists.items = pagedItems.items;
    widgetRows.value.artists.count = pagedItems.total;
  });
  api.getLibraryAlbums(undefined, undefined, 20, undefined, 'timestamp_added DESC').then((pagedItems) => {
    widgetRows.value.albums.items = pagedItems.items;
    widgetRows.value.albums.count = pagedItems.total;
  });

  // playlists widget = recent played playlists + recent added playlists
  api.getRecentlyPlayedItems(10, [MediaType.PLAYLIST]).then((playedItems) => {
    widgetRows.value.playlists.items = playedItems;
    api.getLibraryPlaylists(undefined, undefined, 20, undefined, 'timestamp_added DESC').then((recentItems) => {
      widgetRows.value.playlists.count = recentItems.total;
      const allNames = playedItems.map(function (x) {
        return x.name;
      });
      for (const recentItem of recentItems.items) {
        if (!allNames.includes(recentItem.name)) {
          widgetRows.value.playlists.items.push(recentItem);
        }
      }
    });
  });

  // radios widget = recent played radios + recent added radios
  api.getRecentlyPlayedItems(10, [MediaType.RADIO]).then((playedItems) => {
    widgetRows.value.radios.items = playedItems;
    api.getLibraryRadios(undefined, undefined, 20, undefined, 'timestamp_added DESC').then((recentItems) => {
      widgetRows.value.radios.count = recentItems.total;
      const allNames = playedItems.map(function (x) {
        return x.name;
      });
      for (const recentItem of recentItems.items) {
        if (!allNames.includes(recentItem.name)) {
          widgetRows.value.radios.items.push(recentItem);
        }
      }
    });
  });
  // tracks widget
  api.getLibraryTracks(undefined, undefined, 20, undefined, 'timestamp_added DESC').then((pagedItems) => {
    widgetRows.value.tracks.items = pagedItems.items;
    widgetRows.value.tracks.count = pagedItems.total;
  });
  // browse widget
  await api.browse('', (data: MediaItemType[]) => {
    widgetRows.value.browse.items.push(...data);
  });
});

const itemClicked = function (mediaItem: MediaItemType) {
  if (itemIsAvailable(mediaItem) && ['artist', 'album', 'playlist'].includes(mediaItem.media_type)) {
    router.push({
      name: mediaItem.media_type,
      params: {
        itemId: mediaItem.item_id,
        provider: mediaItem.provider,
      },
    });
  } else if (mediaItem.media_type === MediaType.FOLDER) {
    router.push({
      name: 'browse',
      query: { path: (mediaItem as BrowseFolder).path },
    });
  } else {
    eventbus.emit('playdialog', {
      items: [mediaItem],
      showContextMenuItems: true,
    });
  }
};
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
