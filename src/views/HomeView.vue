<template>
  <div>
    <Container variant="panel">
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
        <div
          v-else-if="widgetRow.players && widgetRow.players.length"
          class="widget-row"
        >
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
          <v-slide-group show-arrows>
            <v-slide-group-item
              v-for="player in widgetRow.players"
              :key="player.player_id"
            >
              <PanelviewPlayerCard
                :player="player"
                style="height: auto; width: auto; max-width: 400px; margin: 5px"
                @click="playerClicked(player)"
              />
            </v-slide-group-item>
          </v-slide-group>
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
  Player,
  EventType,
  type EventMessage,
  PlayerState,
} from '@/plugins/api/interfaces';
import PanelviewItem from '@/components/PanelviewItem.vue';
import Carousel from '@/components/Carousel.vue';
import { onMounted, ref } from 'vue';
import { store } from '@/plugins/store';
import { eventbus } from '@/plugins/eventbus';
import { itemIsAvailable } from '@/helpers/contextmenu';
import router from '@/plugins/router';
import PanelviewPlayerCard from '@/components/PanelviewPlayerCard.vue';
import { onBeforeUnmount } from 'vue';
import Container from '@/components/mods/Container.vue';

interface WidgetRow {
  label: string;
  icon: string;
  path?: string;
  items: MediaItemType[];
  count?: number;
  players?: Player[];
}

const widgetRows = ref<Record<string, WidgetRow>>({
  queue: {
    label: 'currently_playing',
    icon: 'mdi-playlist-play',
    items: [],
  },
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
  const unsub = api.subscribe(EventType.PLAYER_UPDATED, (evt: EventMessage) => {
    // update the now playing widget row
    updateCurrentlyPlayingQueueWidgetRow();
  });
  onBeforeUnmount(unsub);

  updateCurrentlyPlayingQueueWidgetRow();
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

const updateCurrentlyPlayingQueueWidgetRow = function () {
  api.getPlayers().then((players) => {
    for (var player of players) {
      var player_queue = api.queues[player.player_id];
      if (
        player_queue &&
        player_queue.items > 0 &&
        player.powered &&
        isOwnActiveSource(player)
      ) {
        if (!widgetRows.value.queue.players) {
          widgetRows.value.queue.players = [];
        }
        if (
          !widgetRows.value.queue.players.some(
            (p) => p.player_id === player.player_id,
          )
        ) {
          widgetRows.value.queue.players.push(player);
          widgetRows.value.queue.players.sort((a, b) =>
            a.display_name.localeCompare(b.display_name),
          );
          widgetRows.value.queue.players.sort(
            (a, b) => playerStateOrder[a.state] - playerStateOrder[b.state],
          );
        }
      }
    }
  });
};

const isOwnActiveSource = function (player: Player) {
  return player.active_source === player.player_id;
};

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

const playerClicked = function (player: Player) {
  const newDefaultPlayer = player;
  if (newDefaultPlayer) {
    store.selectedPlayer = newDefaultPlayer;
    updateCurrentlyPlayingQueueWidgetRow();
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
