<template>
  <div>
    <Container variant="panel">
      <!-- now playing widget row -->
      <div v-if="nowPlayingWidgetRow.length" class="widget-row">
        <v-toolbar color="transparent" style="width: fit-content">
          <template #prepend><v-icon icon="mdi-playlist-play" /></template>
          <template #title>
            <span class="mr-3">{{ $t('currently_playing') }}</span>
          </template>
        </v-toolbar>
        <carousel>
          <swiper-slide
            v-for="queue in nowPlayingWidgetRow"
            :key="queue.queue_id"
            style="min-width: 300px; max-width: 500px"
          >
            <PanelviewPlayerCard
              :queue="queue"
              @click="playerQueueClicked(queue)"
            />
          </swiper-slide>
        </carousel>
      </div>
      <!-- all other widget rows -->
      <div v-for="widgetRow in widgetRows" :key="widgetRow.label">
        <div v-if="widgetRow.items.length" class="widget-row">
          <v-toolbar
            color="transparent"
            :style="
              widgetRow.path
                ? 'cursor: pointer; width: fit-content;'
                : 'width: fit-content;'
            "
            @click="widgetRow.path ? $router.replace(widgetRow.path) : ''"
          >
            <template #prepend><v-icon :icon="widgetRow.icon" /></template>
            <template #title>
              <v-badge
                v-if="widgetRow.count"
                inline
                color="grey"
                :content="widgetRow.count"
              >
                <span class="mr-3">{{ $t(widgetRow.label) }}</span>
              </v-badge>
              <template v-else>
                <span class="mr-3">{{ $t(widgetRow.label) }}</span>
              </template>
            </template>
          </v-toolbar>
          <carousel>
            <swiper-slide v-for="item in widgetRow.items" :key="item.uri">
              <PanelviewItem
                :item="item"
                :show-checkboxes="false"
                :show-track-number="false"
                :is-selected="false"
                @click="itemClicked"
              />
            </swiper-slide>
          </carousel>
        </div>
      </div>
    </Container>
  </div>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import {
  BrowseFolder,
  MediaItemType,
  MediaType,
  PlayerState,
  PlayerQueue,
} from '@/plugins/api/interfaces';
import PanelviewItem from '@/components/PanelviewItem.vue';
import Carousel from '@/components/Carousel.vue';
import { computed, onMounted, ref } from 'vue';
import { store } from '@/plugins/store';
import { eventbus } from '@/plugins/eventbus';
import { itemIsAvailable } from '@/helpers/contextmenu';
import router from '@/plugins/router';
import PanelviewPlayerCard from '@/components/PanelviewPlayerCard.vue';
import Container from '@/components/mods/Container.vue';

interface WidgetRow {
  label: string;
  icon: string;
  path?: string;
  items: MediaItemType[];
  count?: number;
  queues?: PlayerQueue[];
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
  // recently played widget row
  api.getRecentlyPlayedItems(20).then((items) => {
    widgetRows.value.recently_played.items = items;
  });
  // library artists widget row
  api
    .getLibraryArtists(undefined, undefined, 20, undefined, 'RANDOM()')
    .then((pagedItems) => {
      widgetRows.value.artists.items = pagedItems.items;
      widgetRows.value.artists.count = pagedItems.total;
    });

  // library albums widget row
  api
    .getLibraryAlbums(
      undefined,
      undefined,
      20,
      undefined,
      'timestamp_added DESC',
    )
    .then((pagedItems) => {
      widgetRows.value.albums.items = pagedItems.items;
      widgetRows.value.albums.count = pagedItems.total;
    });

  // library playlist widget row
  api
    .getLibraryPlaylists(
      undefined,
      undefined,
      20,
      undefined,
      'timestamp_added DESC',
    )
    .then((pagedItems) => {
      widgetRows.value.playlists.items = pagedItems.items;
      widgetRows.value.playlists.count = pagedItems.total;
    });

  // library radios widget row
  api
    .getLibraryRadios(
      undefined,
      undefined,
      20,
      undefined,
      'timestamp_added DESC',
    )
    .then((pagedItems) => {
      widgetRows.value.radios.items = pagedItems.items;
      widgetRows.value.radios.count = pagedItems.total;
    });
  // tracks widget
  api
    .getLibraryTracks(
      undefined,
      undefined,
      20,
      undefined,
      'timestamp_added DESC',
    )
    .then((pagedItems) => {
      widgetRows.value.tracks.items = pagedItems.items;
      widgetRows.value.tracks.count = pagedItems.total;
    });
  // browse widget
  await api.browse('', (data: MediaItemType[]) => {
    widgetRows.value.browse.items.push(...data);
  });
});

const playerStateOrder = {
  [PlayerState.PLAYING]: 1,
  [PlayerState.PAUSED]: 2,
  [PlayerState.IDLE]: 2,
} as const;

const nowPlayingWidgetRow = computed(() => {
  return Object.values(api.queues)
    .filter(
      (x) =>
        x.active &&
        x.items > 0 &&
        x.queue_id in api.players &&
        api.players[x.queue_id].powered,
    )
    .sort((a, b) => a.display_name.localeCompare(b.display_name))
    .sort((a, b) => playerStateOrder[a.state] - playerStateOrder[b.state]);
});

const itemClicked = function (mediaItem: MediaItemType) {
  if (
    itemIsAvailable(mediaItem) &&
    ['artist', 'album', 'playlist'].includes(mediaItem.media_type)
  ) {
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

const playerQueueClicked = function (queue: PlayerQueue) {
  if (queue && queue.queue_id in api.players) {
    store.selectedPlayerId = queue.queue_id;
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
  margin-left: 0px;
  padding-left: 0px;
}

.v-slide-group__prev {
  min-width: 0px !important;
}

.v-slide-group__prev.v-slide-group__prev--disabled {
  visibility: hidden;
  margin-right: -15px;
}

.v-slide-group__next {
  min-width: 15px !important;
}

.v-slide-group__next.v-slide-group__next--disabled {
  visibility: hidden;
}
</style>
