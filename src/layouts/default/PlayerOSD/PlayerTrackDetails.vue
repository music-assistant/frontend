<template>
  <!-- now playing media -->
  <v-list-item
    style="
      height: 60px;
      width: fit-content;
      margin-top: -5px;
      padding-bottom: 30px;
      padding-top: 5px;
    "
    lines="two"
  >
    <template #prepend>
      <div class="listitem-thumb">
        <PlayerFullscreen :show-fullscreen="store.showFullscreenPlayer" />
        <MediaItemThumb
          v-if="curQueueItem"
          :item="curQueueItem.media_item || curQueueItem"
          :width="50"
          style="cursor: pointer"
          @click="store.showFullscreenPlayer = true"
        />
        <v-img v-else height="50" :src="iconFallback" style="opacity: 50%" />
      </div>
    </template>

    <!-- title -->
    <template #title>
      <span
        v-if="curQueueItem && curQueueItem.media_item"
        style="cursor: pointer"
        @click="
          curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''
        "
      >
        {{ curQueueItem.media_item.name }}
        <span
          v-if="
            'version' in curQueueItem.media_item &&
            curQueueItem.media_item.version
          "
          >({{ curQueueItem.media_item.version }})</span
        >
      </span>
      <span v-else-if="curQueueItem">
        {{ curQueueItem.name }}
      </span>
      <!-- queue name -->
      <div v-else-if="activePlayerQueue">
        {{ activePlayerQueue?.display_name }}
      </div>
      <!-- player name -->
      <div v-else-if="store.selectedPlayer">
        {{ store.selectedPlayer?.display_name }}
      </div>
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
        style="cursor: pointer"
        class="line-clamp-1"
        @click="
          curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''
        "
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
        style="cursor: pointer"
        @click="
          curQueueItem?.media_item && 'artists' in curQueueItem.media_item
            ? itemClick(curQueueItem.media_item.artists[0])
            : ''
        "
      >
        {{ curQueueItem.media_item.artists[0].name }}
      </div>
      <!-- radio live metadata -->
      <div
        class="line-clamp-1"
        v-else-if="curQueueItem?.streamdetails?.stream_title"
      >
        {{ curQueueItem?.streamdetails?.stream_title }}
      </div>
      <!-- other description -->
      <div
        class="line-clamp-1"
        v-else-if="
          curQueueItem && curQueueItem.media_item?.metadata.description
        "
      >
        {{ curQueueItem.media_item.metadata.description }}
      </div>
      <!-- queue empty message -->
      <div class="line-clamp-1" v-else-if="activePlayerQueue && activePlayerQueue.items == 0">
        {{ $t("queue_empty") }}
      </div>
      <!-- 3rd party source active -->
      <div
        class="line-clamp-1"
        v-else-if="
          store.selectedPlayer?.active_source != store.selectedPlayer?.player_id
        "
      >
        {{
          $t("external_source_active", [store.selectedPlayer?.active_source])
        }}
      </div>
    </template>
  </v-list-item>
</template>

<script setup lang="ts">
import { computed } from "vue";

import api from "@/plugins/api";
import {
  MediaType,
  MediaItemType,
  ItemMapping,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import { getArtistsString } from "@/utils";
import { useRouter } from "vue-router";
import PlayerFullscreen from "./PlayerFullscreen.vue";
import { iconFallback, iconSmallFlac } from "@/components/ProviderIcons.vue";
import { getResponsiveBreakpoints } from "@/utils";

const router = useRouter();

// properties
interface Props {
  showOnlyArtist?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  showOnlyArtist: false,
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

// methods
const itemClick = function (item: MediaItemType | ItemMapping) {
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};
</script>