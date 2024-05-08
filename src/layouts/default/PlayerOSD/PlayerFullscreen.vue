<template>
  <v-dialog
    v-if="!store.showPlayersMenu"
    v-model="store.showFullscreenPlayer"
    fullscreen
    :scrim="false"
    style="overflow: hidden"
    transition="dialog-bottom-transition"
  >
    <v-card :color="darkenBrightColors(coverImageColorCode, 77, 40)">
      <v-toolbar class="v-toolbar-default" color="transparent">
        <template #prepend>
          <Button icon @click="store.showFullscreenPlayer = false">
            <v-icon icon="mdi-chevron-down" />
          </Button>
        </template>
        <template #append>
          <Button icon @click="store.showFullscreenPlayer = false">
            <v-icon icon="mdi-dots-vertical" @click.stop="openQueueMenu" />
          </Button>
        </template>
      </v-toolbar>

      <!-- content -->
      <div class="main">
        <!-- left column: media thumb + details-->
        <div
          v-if="getBreakpointValue('bp7') || !store.showQueueItems"
          class="main-media-details"
        >
          <div class="main-media-details-image">
            <MediaItemThumb
              :item="store.curQueueItem"
              :thumbnail="false"
              style="max-width: 100%; width: auto"
            />
          </div>
          <div class="main-media-details-track-info">
            <!-- title -->
            <div
              v-if="store.curQueueItem?.media_item"
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
              @click="itemClick(store.curQueueItem.media_item as MediaItemType)"
            >
              {{ store.curQueueItem.media_item.name }}
              <!-- append version if needed -->
              <span
                v-if="
                  'version' in store.curQueueItem.media_item &&
                  store.curQueueItem.media_item.version
                "
                >( {{ store.curQueueItem.media_item.version }})</span
              >
            </div>

            <!-- fallback title when no player selected or no queue active-->
            <v-card-title
              v-else
              :style="`font-size: ${titleFontSize};cursor:pointer;`"
              @click="store.showPlayersMenu = true"
            >
              {{ store.selectedPlayer?.display_name || $t('no_player') }}
            </v-card-title>

            <!-- subtitle: radio station stream title -->
            <v-card-subtitle
              v-if="
                store.curQueueItem?.media_item?.media_type == MediaType.RADIO &&
                store.curQueueItem?.streamdetails?.stream_title
              "
              class="text-h6 text-md-h5 text-lg-h4"
              @click="
                radioTitleClick(store.curQueueItem.streamdetails.stream_title)
              "
            >
              {{ store.curQueueItem.streamdetails.stream_title }}
            </v-card-subtitle>

            <!-- subtitle: album -->
            <v-card-subtitle
              v-if="
                store.curQueueItem?.media_item &&
                'album' in store.curQueueItem.media_item &&
                store.curQueueItem.media_item.album
              "
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="itemClick(store.curQueueItem.media_item.album)"
            >
              {{ store.curQueueItem.media_item.album.name }}
            </v-card-subtitle>

            <!-- subtitle: artist(s) -->
            <!-- TODO enumerate all artists -->
            <v-card-subtitle
              v-if="
                store.curQueueItem?.media_item &&
                'artists' in store.curQueueItem.media_item &&
                store.curQueueItem.media_item.artists.length
              "
              :style="`font-size: ${subTitleFontSize};cursor:pointer;`"
              @click="itemClick(store.curQueueItem.media_item.artists[0])"
            >
              {{ store.curQueueItem.media_item.artists[0].name }}
            </v-card-subtitle>

            <!-- subtitle: other source active -->
            <v-card-subtitle
              v-if="
                store.selectedPlayer?.active_source !=
                store.selectedPlayer?.player_id
              "
              :style="`font-size: ${subTitleFontSize}`"
            >
              <!-- TODO: show media details of other source if possible? -->
              {{
                $t('external_source_active', [
                  store.selectedPlayer?.active_source,
                ])
              }}
            </v-card-subtitle>

            <!-- subtitle: queue empty -->
            <v-card-subtitle
              v-else-if="
                store.activePlayerQueue && store.activePlayerQueue.items == 0
              "
              :style="`font-size: ${subTitleFontSize}`"
            >
              {{ $t('queue_empty') }}
            </v-card-subtitle>

            <!-- streamdetails/contenttype button-->
            <div style="margin: auto; padding-top: 20px">
              <QualityDetailsBtn />
            </div>
          </div>
        </div>

        <!-- right column: queue items-->
        <div v-if="store.showQueueItems" class="main-queue-items">
          <v-tabs v-model="activeQueuePanel" hide-slider density="compact">
            <v-tab :value="0">
              {{ $t('queue') }}
              <v-badge color="grey" :content="nextItems.length" inline />
            </v-tab>
            <v-tab :value="1">
              {{ $t('played') }}
              <v-badge color="grey" :content="previousItems.length" inline />
            </v-tab>
          </v-tabs>
          <v-infinite-scroll
            :items="nextItems"
            :onLoad="loadNextPage"
            :empty-text="''"
            style="max-height: 95%; height: 100%; overflow-y: hidden"
          >
            <!-- list view -->
            <v-virtual-scroll
              :height="70"
              :items="activeQueuePanel == 0 ? nextItems : previousItems"
              style="height: 100%"
            >
              <template #default="{ item }">
                <ListItem
                  link
                  :show-menu-btn="true"
                  @click.stop="(e) => openQueueItemMenu(e, item)"
                  @menu.stop="(e) => openQueueItemMenu(e, item)"
                >
                  <template #prepend>
                    <div class="media-thumb listitem-media-thumb">
                      <MediaItemThumb size="50" :item="item" />
                    </div>
                  </template>
                  <template #title>
                    {{ item.name }}
                  </template>
                  <template #subtitle>
                    {{ formatDuration(item.duration) }}
                    <span
                      v-if="
                        item.media_item &&
                        'album' in item.media_item &&
                        item.media_item.album
                      "
                    >
                      | {{ item.media_item.album.name }}</span
                    >
                  </template>
                </ListItem>
              </template>
            </v-virtual-scroll>
          </v-infinite-scroll>
        </div>
      </div>

      <!-- player controls (always at bottom)-->
      <div class="player-bottom">
        <!-- row with player control (left) and volume (right) -->
        <div style="height: 50px">
          <SpeakerBtn
            style="position: absolute; margin-left: 3%; right: auto"
          />
          <VolumeBtn
            :responsive-volume-size="true"
            style="position: absolute; margin-left: auto; right: 5%"
          />
        </div>
        <!-- timeline / progressbar-->
        <div class="row" style="margin-left: 5%; margin-right: 5%">
          <PlayerTimeline
            :is-progress-bar="false"
            :color="
              $vuetify.theme.current.dark
                ? props.colorPalette.lightColor
                : props.colorPalette.darkColor
            "
          />
        </div>

        <!-- main media control buttons (play, next, previous etc.)-->
        <div class="media-controls">
          <FavoriteBtn
            class="media-controls-item"
            max-height="35px"
            :item="store.curQueueItem?.media_item"
          />
          <ShuffleBtn
            v-if="$vuetify.display.mdAndUp"
            class="media-controls-item"
            max-height="30px"
          />
          <PreviousBtn class="media-controls-item" max-height="45px" />
          <PlayBtn class="media-controls-item" max-height="100px" />
          <NextBtn class="media-controls-item" max-height="45px" />
          <RepeatBtn
            v-if="$vuetify.display.mdAndUp"
            class="media-controls-item"
            max-height="35px"
          />
          <QueueBtn class="media-controls-item" max-height="30px" />
        </div>
      </div>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import api from '@/plugins/api';
import {
  EventType,
  MediaItemType,
  MediaType,
  QueueItem,
  Track,
} from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import PlayerTimeline from './PlayerTimeline.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import Button from '@/components/mods/Button.vue';
import ListItem from '@/components/mods/ListItem.vue';
import vuetify from '@/plugins/vuetify';
import FavoriteBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/FavoriteBtn.vue';
import PlayBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/PlayBtn.vue';
import NextBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/NextBtn.vue';
import PreviousBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/PreviousBtn.vue';
import ShuffleBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleBtn.vue';
import RepeatBtn from '@/layouts/default/PlayerOSD/PlayerControlBtn/RepeatBtn.vue';
import QueueBtn from './PlayerControlBtn/QueueBtn.vue';
import SpeakerBtn from './PlayerControlBtn/SpeakerBtn.vue';
import VolumeBtn from './PlayerControlBtn/VolumeBtn.vue';
import QualityDetailsBtn from '@/components/QualityDetailsBtn.vue';
import router from '@/plugins/router';
import {
  ImageColorPalette,
  darkenBrightColors,
  formatDuration,
} from '@/helpers/utils';
import { eventbus } from '@/plugins/eventbus';
import { useDisplay } from 'vuetify';
import { useI18n } from 'vue-i18n';

const { t } = useI18n();
const { name } = useDisplay();

interface Props {
  colorPalette: ImageColorPalette;
}
const props = defineProps<Props>();

// Local refs
const queueItems = ref<QueueItem[]>([]);
const coverImageColorCode = ref<string>('');
const activeQueuePanel = ref(0);

// Computed properties

const nextItems = computed(() => {
  if (store.activePlayerQueue) {
    return queueItems.value.slice(store.activePlayerQueue.current_index);
  } else return [];
});
const previousItems = computed(() => {
  if (store.activePlayerQueue) {
    return queueItems.value.slice(0, store.activePlayerQueue.current_index);
  } else return [];
});

const titleFontSize = computed(() => {
  switch (name.value) {
    case 'xs':
      return '1.2em';
    case 'sm':
      return '1.6em';
    case 'md':
      return '2em';
    case 'lg':
      return store.showQueueItems ? '1.5em' : '2.5em';
    case 'xl':
      return store.showQueueItems ? '1.6em' : '3em';
    case 'xxl':
      return store.showQueueItems ? '1.7em' : '3.2em';
    default:
      return '1.0em.';
  }
});

const subTitleFontSize = computed(() => {
  switch (name.value) {
    case 'xs':
      return '1.0em';
    case 'sm':
      return '1.2em';
    case 'md':
      return '1.7em';
    case 'lg':
      return store.showQueueItems ? '1.0em' : '1.6em';
    case 'xl':
      return store.showQueueItems ? '1.2em' : '2em';
    case 'xxl':
      return store.showQueueItems ? '1.2em' : '2em';
    default:
      return '1.0em.';
  }
});

// methods

const itemClick = function (item: MediaItemType) {
  // mediaItem in the list is clicked
  store.showFullscreenPlayer = false;
  router.push({
    name: item.media_type,
    params: {
      itemId: item.item_id,
      provider: item.provider,
    },
  });
};

const radioTitleClick = function (streamTitle: string) {
  // radio station title clicked
  store.globalSearchTerm = streamTitle;
  router.push({ name: 'search' });
  store.showFullscreenPlayer = false;
};

const openQueueItemMenu = function (evt: Event, item: QueueItem) {
  const itemIndex = queueItems.value.indexOf(item);
  const menuItems = [
    {
      label: 'play_now',
      labelArgs: [],
      action: () => {
        queueCommand(item, 'play_now');
      },
      icon: 'mdi-play-circle-outline',
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: 'play_next',
      labelArgs: [],
      action: () => {
        queueCommand(item, 'move_next');
      },
      icon: 'mdi-skip-next-circle-outline',
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: 'queue_move_up',
      labelArgs: [],
      action: () => {
        queueCommand(item, 'up');
      },
      icon: 'mdi-arrow-up',
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: 'queue_move_down',
      labelArgs: [],
      action: () => {
        queueCommand(item, 'down');
      },
      icon: 'mdi-arrow-down',
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
    {
      label: 'queue_delete',
      labelArgs: [],
      action: () => {
        queueCommand(item, 'delete');
      },
      icon: 'mdi-delete',
      disabled: itemIndex <= (store.activePlayerQueue?.index_in_buffer || 0),
    },
  ];
  if (item?.media_item?.media_type == MediaType.TRACK) {
    menuItems.push({
      label: 'show_info',
      labelArgs: [],
      action: () => {
        itemClick(item.media_item as Track);
      },
      icon: 'mdi-information-outline',
      disabled: false,
    });
  }
  eventbus.emit('contextmenu', {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const openQueueMenu = function (evt: Event) {
  const menuItems = [
    {
      label: 'settings.player_settings',
      labelArgs: [],
      action: () => {
        store.showFullscreenPlayer = false;
        router.push(
          `/settings/editplayer/${store.activePlayerQueue!.queue_id}`,
        );
      },
      icon: 'mdi-cog-outline',
    },
    {
      label: 'queue_clear',
      labelArgs: [],
      action: () => {
        api.queueCommandClear(store.activePlayerQueue!.queue_id);
      },
      icon: 'mdi-cancel',
    },
    {
      label: store.activePlayerQueue!.shuffle_enabled
        ? 'shuffle_enabled'
        : 'shuffle_disabled',
      labelArgs: [],
      action: () => {
        api.queueCommandShuffleToggle(store.activePlayerQueue!.queue_id);
      },
      icon: store.activePlayerQueue!.shuffle_enabled
        ? 'mdi-shuffle'
        : 'mdi-shuffle-disabled',
    },
    {
      label: 'repeat_mode',
      labelArgs: [t(`repeatmode.${store.activePlayerQueue!.repeat_mode}`)],
      action: () => {
        api.queueCommandRepeatToggle(store.activePlayerQueue!.queue_id);
      },
      icon: store.activePlayerQueue!.shuffle_enabled
        ? 'mdi-repeat'
        : 'mdi-repeat-off',
    },
  ];
  eventbus.emit('contextmenu', {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const queueCommand = function (item: QueueItem | undefined, command: string) {
  if (!item || !store.activePlayerQueue) return;
  if (command == 'play_now') {
    api.queueCommandPlayIndex(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'move_next') {
    api.queueCommandMoveNext(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'up') {
    api.queueCommandMoveUp(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'down') {
    api.queueCommandMoveDown(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  } else if (command == 'delete') {
    api.queueCommandDelete(
      store.activePlayerQueue?.queue_id,
      item.queue_item_id,
    );
  }
};

const loadItems = async function () {
  queueItems.value = [];
  if (store.activePlayerQueue) {
    const result = await api.getPlayerQueueItems(
      store.activePlayerQueue.queue_id,
      (store.activePlayerQueue.current_index || 0) + 50,
      0,
    );
    queueItems.value = result.items as QueueItem[];
  }
};

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const loadNextPage = function ({ done }: { done: any }) {
  if (queueItems.value.length == 0) {
    done('empty');
    return;
  }
  if (!store.activePlayerQueue || store.activePlayerQueue.items == 0) {
    done('empty');
    return;
  }
  if (queueItems.value.length >= store.activePlayerQueue?.items) {
    done('empty');
    return;
  }
  done('loading');
  api
    .getPlayerQueueItems(
      store.activePlayerQueue.queue_id,
      (store.activePlayerQueue.current_index || 0) + 50,
      0,
    )
    .then((pagedItems) => {
      queueItems.value.push(...(pagedItems.items as QueueItem[]));
      done('ok');
    });
};

// listen for item updates to refresh items when that happens
onMounted(() => {
  const unsub = api.subscribe(EventType.QUEUE_ITEMS_UPDATED, loadItems);
  onBeforeUnmount(unsub);
});

// watchers
watch(
  () => store.activePlayerQueue,
  (val) => {
    if (val) {
      loadItems();
    }
  },
  { immediate: true },
);

watch(
  () => props.colorPalette,
  (result) => {
    if (!result.darkColor || !result.lightColor) {
      coverImageColorCode.value = vuetify.theme.current.value.dark
        ? '#000'
        : '#fff';
    } else {
      coverImageColorCode.value = vuetify.theme.current.value.dark
        ? result.darkColor
        : result.lightColor;
    }
  },
);
</script>

<style scoped>
.main {
  display: flex;
  max-height: 75% !important;
  height: 65% !important;
  padding-bottom: 5px;
}

.main-media-details {
  flex: 50%;
  max-width: 100%;
  width: 50%;
}

.main-queue-items {
  flex: 50%;
  max-width: 100%;
}

.main-media-details-image {
  height: 70%;
  max-height: 70%;
  align-content: center;
  padding: 20px;
}
.main-media-details-image.v-img {
  width: auto;
}
.main-media-details-track-info {
  height: 30%;
  max-height: 30%;
  align-content: center;
  text-align: center;
  padding: 20px;
}

.player-bottom {
  max-height: 35% !important;
  margin-top: auto;
  bottom: 0;
  position: unset !important;
  padding-bottom: 5%;
}

.track-info {
  margin-top: 10px;
  margin-bottom: 10px;
  padding-top: 2vh;
  padding-bottom: 2vh;
  text-align: center;
  line-height: 10%;
}

.track-info-subtitle {
  opacity: 0.5;
}

.v-tab {
  opacity: 0.5;
}
.v-tab-item--selected {
  opacity: 1;
}

.media-controls {
  display: flex;
  flex: 1 1 auto;
  align-items: center;
  justify-content: center;
  max-width: 100%;
  padding: 15px;
  height: 100px;
}

.media-controls-item {
  margin: 0 10px;
  width: 100%;
  height: 100%;
}

@media (max-width: 768px) {
  .media-controls-item {
    margin: 0 5px;
    width: 100%;
    height: 100%;
  }
}

.row {
  align-content: center;
}

.row-centered {
  justify-content: center;
  max-width: 100%;
  padding: 15px;
}

.media-controls > button {
  flex: 1 1 auto;
}

.media-controls-bottom {
  display: flex;
  flex: 0 1 auto;
  justify-content: center;
  align-items: center;
}

.media-controls-bottom > div {
  flex-basis: 0;
  flex-grow: 1;
  max-width: 100%;
}

.media-controls > div {
  width: calc(100% / 3);
}

.mediacontrols-right {
  display: table-cell;
  text-align: right;
  vertical-align: middle;
}

.mediacontrols-right > div {
  display: inline-flex;
  align-items: center;
}
</style>
