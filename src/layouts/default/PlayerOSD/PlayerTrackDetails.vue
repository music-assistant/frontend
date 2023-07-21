<template>
  <!-- now playing media -->
  <ListItem style="height: auto; width: fit-content; margin: 0px; padding: 0px" lines="two">
    <template #prepend>
      <div
        class="media-thumb player-media-thumb"
        :style="`height: ${getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64}px; width: ${
          getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64
        }px; `"
      >
        <PlayerFullscreen :show-fullscreen="store.showFullscreenPlayer" />
        <MediaItemThumb
          v-if="curQueueItem"
          :item="curQueueItem.media_item || curQueueItem"
          style="cursor: pointer"
          @click="store.showFullscreenPlayer = true"
        />
        <v-img v-else :src="iconFallback" style="opacity: 50%" />
      </div>
    </template>

    <!-- title -->
    <template #title>
      <div
        v-if="curQueueItem && curQueueItem.media_item"
        :style="{
          cursor: 'pointer',
          color:
            !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
            isColorDark(store.coverImageColorCode.darkColor)
              ? '#000'
              : '#fff',
        }"
        @click="curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''"
      >
        {{ curQueueItem.media_item.name }}
        <span v-if="'version' in curQueueItem.media_item && curQueueItem.media_item.version"
          >({{ curQueueItem.media_item.version }})</span
        >
      </div>
      <div v-else-if="curQueueItem">
        {{ curQueueItem.name }}
      </div>
    </template>
    <!-- append -->
    <template #append>
      <!-- format -->
      <v-chip
        v-if="
          streamDetails?.audio_format.content_type &&
          !getBreakpointValue({ breakpoint: 'phone' }) &&
          showQualityDetailsBtn
        "
        :disabled="!activePlayerQueue || !activePlayerQueue?.active || activePlayerQueue?.items == 0"
        class="player-track-content-type"
        :style="
          $vuetify.theme.current.dark
            ? 'color: #000; background: #fff; margin-left: 15px;'
            : 'color: #fff; background: #000; margin-left: 15px;'
        "
        label
        :ripple="false"
        v-bind="props"
      >
        <div class="d-flex justify-center" style="width: 100%">
          {{ streamDetails.audio_format.content_type.toUpperCase() }}
        </div>
      </v-chip>
    </template>
    <!-- subtitle -->
    <template #subtitle>
      <!-- track: artists(s) + album -->
      <div
        v-if="
          curQueueItem &&
          curQueueItem.media_item?.media_type == MediaType.TRACK &&
          'album' in curQueueItem.media_item &&
          curQueueItem.media_item.album &&
          !props.showOnlyArtist
        "
        :style="{
          cursor: 'pointer',
          color:
            !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
            isColorDark(store.coverImageColorCode.darkColor)
              ? '#000'
              : '#fff',
        }"
        class="line-clamp-1"
        @click="curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''"
      >
        {{ getArtistsString(curQueueItem.media_item.artists) }} •
        {{ curQueueItem.media_item.album.name }}
      </div>
      <!-- track/album falback: artist present -->
      <div
        v-else-if="
          curQueueItem &&
          curQueueItem.media_item &&
          'artists' in curQueueItem.media_item &&
          curQueueItem.media_item.artists.length > 0
        "
        class="line-clamp-1"
        :style="{
          cursor: 'pointer',
          color:
            !getBreakpointValue({ breakpoint: 'bp3', condition: 'lt' }) &&
            isColorDark(store.coverImageColorCode.darkColor)
              ? '#000'
              : '#fff',
        }"
        @click="
          curQueueItem?.media_item && 'artists' in curQueueItem.media_item
            ? itemClick(curQueueItem.media_item.artists[0])
            : ''
        "
      >
        {{ curQueueItem.media_item.artists[0].name }}
      </div>
      <!-- radio live metadata -->
      <div v-else-if="curQueueItem?.streamdetails?.stream_title" class="line-clamp-1">
        {{ curQueueItem?.streamdetails?.stream_title }}
      </div>
      <!-- other description -->
      <div v-else-if="curQueueItem && curQueueItem.media_item?.metadata.description" class="line-clamp-1">
        {{ curQueueItem.media_item.metadata.description }}
      </div>
      <!-- queue empty message -->
      <div v-else-if="activePlayerQueue && activePlayerQueue.items == 0" class="line-clamp-1">
        {{ $t('queue_empty') }}
      </div>
      <!-- 3rd party source active -->
      <div v-else-if="store.selectedPlayer?.active_source != store.selectedPlayer?.player_id" class="line-clamp-1">
        {{ $t('external_source_active', [store.selectedPlayer?.active_source]) }}
      </div>
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { MediaType, MediaItemType, ItemMapping } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import { getArtistsString, isColorDark } from '@/helpers/utils';
import { useRouter } from 'vue-router';
import PlayerFullscreen from './PlayerFullscreen.vue';
import { iconFallback } from '@/components/QualityDetailsBtn.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';

const router = useRouter();

// properties
interface Props {
  showOnlyArtist?: boolean;
  showQualityDetailsBtn?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
  showQualityDetailsBtn: true,
});

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});
const streamDetails = computed(() => {
  return activePlayerQueue.value?.current_item?.streamdetails;
});

// methods
const itemClick = function (item: MediaItemType | ItemMapping) {
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};
</script>

<style>
.player-media-thumb {
  margin-right: 10px;
}

.player-track-content-type {
  height: 20px !important;
  padding: 5px !important;
  padding-right: 9px !important;
  padding-left: 9px !important;
  font-weight: 500;
  font-size: 10px !important;
  letter-spacing: 0.1em;
  border-radius: 2px;
  margin-right: 30px;
}
</style>
