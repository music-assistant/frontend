<template>
  <v-card
    class="panel-item"
    :class="{
      'panel-item-selected': store.selectedPlayerId == queue.queue_id,
      'panel-item-idle': queue.state == PlayerState.PAUSED,
    }"
  >
    <!-- now playing media -->
    <v-list-item class="panel-item-details" flat>
      <template #prepend>
        <div class="media-thumb player-media-thumb">
          <MediaItemThumb
            size="60"
            :item="queue.current_item?.media_item || queue.current_item"
            :fallback="imgCoverDark"
            style="cursor: pointer"
          />
        </div>
      </template>

      <!-- title -->
      <template #title>
        <div
          :style="{
            cursor: 'pointer',
          }"
        >
          <div v-if="queue.current_item?.media_item">
            {{ queue.current_item?.media_item.name }}
            <span
              v-if="
                'version' in queue.current_item?.media_item &&
                queue.current_item?.media_item.version
              "
              >({{ queue.current_item?.media_item.version }})</span
            >
          </div>
          <div v-else-if="queue.current_item">
            {{ queue.current_item?.name }}
          </div>
          <div v-else>
            {{ queue.display_name }}
          </div>
        </div>
      </template>

      <!-- subtitle -->
      <template #subtitle>
        <!-- track: artists(s) + album -->
        <div
          :style="{
            cursor: 'pointer',
          }"
          class="line-clamp-1"
        >
          <div
            v-if="
              queue.current_item?.media_item &&
              queue.current_item?.media_item?.media_type == MediaType.TRACK &&
              'album' in queue.current_item?.media_item &&
              queue.current_item?.media_item.album
            "
          >
            {{ getArtistsString(queue.current_item?.media_item.artists) }} •
            {{ queue.current_item?.media_item.album.name }}
          </div>
          <!-- track/album fallback: artist present -->
          <div
            v-else-if="
              queue.current_item?.media_item &&
              'artists' in queue.current_item?.media_item &&
              queue.current_item?.media_item.artists.length > 0
            "
          >
            {{ queue.current_item?.media_item.artists[0].name }}
          </div>
          <!-- radio live metadata -->
          <div
            v-else-if="queue.current_item?.streamdetails?.stream_title"
            class="line-clamp-1"
          >
            {{ queue.current_item?.streamdetails?.stream_title }}
          </div>
          <!-- other description -->
          <div
            v-else-if="queue.current_item?.media_item?.metadata.description"
            class="line-clamp-1"
          >
            {{ queue.current_item?.media_item.metadata.description }}
          </div>
          <!-- queue empty message -->
          <div v-else-if="queue.items == 0" class="line-clamp-1">
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
              $t('external_source_active', [
                store.selectedPlayer?.active_source,
              ])
            }}
          </div>
        </div>
      </template>
      <!-- player -->
      <template #default>
        <h6>{{ queue.display_name }}</h6>
      </template>
      <!-- play button -->
      <template #append>
        <v-btn
          icon
          variant="text"
          @click.stop="api.queueCommandPlayPause(queue.queue_id)"
        >
          <v-icon
            v-if="queue.state == PlayerState.PLAYING"
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '24' : '32'"
            >mdi-pause-circle-outline</v-icon
          >
          <v-icon
            v-else
            :size="getBreakpointValue({ breakpoint: 'phone' }) ? '24' : '32'"
            >mdi-play-circle-outline</v-icon
          >
        </v-btn>
      </template>
    </v-list-item>
  </v-card>
</template>

<script setup lang="ts">
import api from '@/plugins/api';
import { MediaType, PlayerQueue, PlayerState } from '@/plugins/api/interfaces';
import { store } from '@/plugins/store';
import MediaItemThumb from '@/components/MediaItemThumb.vue';
import { getBreakpointValue } from '@/plugins/breakpoint';
import { imgCoverDark } from '@/components/QualityDetailsBtn.vue';
import { getArtistsString } from '@/helpers/utils';

// properties
export interface Props {
  queue: PlayerQueue;
}
defineProps<Props>();
</script>

<style scoped>
.panel-item {
  height: 75px;
  margin-right: 25px;
  border: none;
  width: 98%;
  border-style: none !important;
  padding: 10px;
}

.panel-item-idle {
  opacity: 0.5;
}

.panel-item-details {
  align-items: center;
  margin-left: 0px !important;
  padding-left: 0px !important;
  padding-right: 0px !important;
}
</style>
