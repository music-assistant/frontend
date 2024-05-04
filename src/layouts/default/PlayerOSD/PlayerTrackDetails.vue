<template>
  <!-- now playing media -->
  <ListItem
    style="height: auto; width: fit-content; margin: 0px; padding: 0px"
    lines="two"
  >
    <template #prepend>
      <div
        class="media-thumb player-media-thumb"
        :style="`height: ${
          getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64
        }px; width: ${
          getBreakpointValue({ breakpoint: 'phone' }) ? 50 : 64
        }px; `"
      >
        <PlayerFullscreen
          :show-fullscreen="store.showFullscreenPlayer"
          :color-palette="colorPalette"
        />
        <MediaItemThumb
          :item="store.curQueueItem?.media_item || store.curQueueItem"
          :fallback="imgCoverDark"
          style="cursor: pointer"
          @click="store.showFullscreenPlayer = true"
        />
      </div>
    </template>

    <!-- title -->
    <template #title>
      <div
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
      >
        <div
          v-if="store.curQueueItem && store.curQueueItem.media_item"
          @click="store.showFullscreenPlayer = true"
        >
          {{ store.curQueueItem.media_item.name }}
          <span
            v-if="
              'version' in store.curQueueItem.media_item &&
              store.curQueueItem.media_item.version
            "
            >({{ store.curQueueItem.media_item.version }})</span
          >
        </div>
        <div v-else-if="store.curQueueItem">
          {{ store.curQueueItem.name }}
        </div>
        <div v-else>
          {{ store.activePlayerQueue?.display_name }}
        </div>
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
        :disabled="
          !store.activePlayerQueue ||
          !store.activePlayerQueue?.active ||
          store.activePlayerQueue?.items == 0
        "
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
        :style="{
          cursor: 'pointer',
          color: primaryColor,
        }"
        class="line-clamp-1"
        @click="store.showFullscreenPlayer = true"
      >
        <div
          v-if="
            store.curQueueItem &&
            store.curQueueItem.media_item?.media_type == MediaType.TRACK &&
            'album' in store.curQueueItem.media_item &&
            store.curQueueItem.media_item.album &&
            !props.showOnlyArtist
          "
        >
          {{ getArtistsString(store.curQueueItem.media_item.artists) }} •
          {{ store.curQueueItem.media_item.album.name }}
        </div>
        <!-- track/album fallback: artist present -->
        <div
          v-else-if="
            store.curQueueItem &&
            store.curQueueItem.media_item &&
            'artists' in store.curQueueItem.media_item &&
            store.curQueueItem.media_item.artists.length > 0
          "
        >
          {{ store.curQueueItem.media_item.artists[0].name }}
        </div>
        <!-- radio live metadata -->
        <div
          v-else-if="store.curQueueItem?.streamdetails?.stream_title"
          class="line-clamp-1"
        >
          {{ store.curQueueItem?.streamdetails?.stream_title }}
        </div>
        <!-- other description -->
        <div
          v-else-if="
            store.curQueueItem &&
            store.curQueueItem.media_item?.metadata.description
          "
          class="line-clamp-1"
        >
          {{ store.curQueueItem.media_item.metadata.description }}
        </div>
        <!-- queue empty message -->
        <div
          v-else-if="
            store.activePlayerQueue && store.activePlayerQueue.items == 0
          "
          class="line-clamp-1"
        >
          {{ $t('queue_empty') }}
        </div>
        <!-- 3rd party source active -->
        <div
          v-else-if="
            store.selectedPlayer?.active_source !=
            store.selectedPlayer?.player_id
          "
          class="line-clamp-1"
        >
          {{
            $t('external_source_active', [store.selectedPlayer?.active_source])
          }}
        </div>
      </div>
    </template>
  </ListItem>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import { MediaType } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import { ImageColorPalette, getArtistsString } from '@/helpers/utils';
import { useRouter } from 'vue-router';
import PlayerFullscreen from './PlayerFullscreen.vue';
import { imgCoverDark } from '@/components/QualityDetailsBtn.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import ListItem from '@/components/mods/ListItem.vue';

const router = useRouter();

// properties
interface Props {
  showOnlyArtist?: boolean;
  showQualityDetailsBtn?: boolean;
  colorPalette: ImageColorPalette;
  primaryColor: string;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
  showQualityDetailsBtn: true,
  primaryColor: '',
});

// computed properties
const streamDetails = computed(() => {
  return store.activePlayerQueue?.current_item?.streamdetails;
});
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
