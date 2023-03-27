<template>
  <v-footer
    bottom
    fixed
    class="d-flex flex-column"
    style="width: 100%; border-top-style: ridge"
    elevation="5"
    app
  >
    <v-divider />
    <v-img
      class="bg-image"
      width="100%"
      cover
      :src="fanartImage"
      :gradient="
        $vuetify.theme.current.dark
          ? 'to bottom, rgba(0,0,0,.80), rgba(0,0,0,.75)'
          : 'to bottom, rgba(255,255,255,.85), rgba(255,255,255,.65)'
      "
      style="
        position: absolute;
        background-size: 100%;
        padding: 0;
        margin-top: -10px;
      "
    />
    <!-- now playing media -->
    <v-list-item
      style="
        height: 60px;
        width: 100%;
        margin-top: -5px;
        padding-bottom: 30px;
        padding-top: 5px;
      "
      lines="two"
    >
      <template #prepend>
        <div class="listitem-thumb">
          <MediaItemThumb
            v-if="curQueueItem"
            :item="curQueueItem.media_item || curQueueItem"
            :width="50"
            style="cursor: pointer"
            @click="
              curQueueItem?.media_item ? itemClick(curQueueItem.media_item) : ''
            "
          />
          <v-img
            v-else
            height="50"
            :src="iconFallback"
            style="opacity: 50%;"
          />
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
          >({{ curQueueItem.media_item.version }})</span>
        </span>
        <span v-else-if="curQueueItem">
          {{ curQueueItem.name }}
        </span>
      </template>

      <!-- subtitle -->
      <template #subtitle>
        <!-- track: artists(s) + album -->
        <div
          v-if="
            curQueueItem && curQueueItem.media_item?.media_type == MediaType.TRACK &&
              'album' in curQueueItem.media_item &&
              curQueueItem.media_item.album
          "
          style="cursor: pointer"
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
            curQueueItem && curQueueItem.media_item &&
              'artists' in curQueueItem.media_item &&
              curQueueItem.media_item.artists.length > 0
          "
        >
          {{ curQueueItem.media_item.artists[0].name }}
        </div>
        <!-- radio live metadata -->
        <div v-else-if="curQueueItem?.streamdetails?.stream_title">
          {{ curQueueItem?.streamdetails?.stream_title }}
        </div>
        <!-- other description -->
        <div v-else-if="curQueueItem && curQueueItem.media_item?.metadata.description">
          {{ curQueueItem.media_item.metadata.description }}
        </div>
        <div v-else-if="!curQueueItem">
          {{ activePlayerQueue?.display_name }}
        </div>
      </template>
      <template #append>
        <div class="listitem-actions">
          <!-- streaming quality details -->
          <v-menu
            v-if="streamDetails"
            location="bottom end"
          >
            <template #activator="{ props }">
              <v-img
                contain
                :src="
                  streamDetails.bit_depth > 16
                    ? iconHiRes
                    : getContentTypeIcon(streamDetails.content_type)
                "
                height="25"
                :style="
                  $vuetify.theme.current.dark ? '' : 'filter: invert(100%)'
                "
                class="v-list-item-subtitle mediadetails-streamdetails"
                v-bind="props"
              />
            </template>
            <v-card
              class="mx-auto"
              width="300"
            >
              <v-list style="overflow: hidden">
                <span
                  class="text-h5"
                  style="padding: 10px"
                >{{
                  $t("stream_details")
                }}</span>
                <v-divider />
                <div style="height: 50px; display: flex; align-items: center">
                  <provider-icon
                    :domain="streamDetails.provider"
                    :size="'35px'"
                    style="object-fit: contain;margin-left:10px;margin-right:5px"
                  />
                  {{ $t("providers." + streamDetails.provider) }}
                </div>

                <div style="height: 50px; display: flex; align-items: center">
                  <img
                    height="30"
                    width="50"
                    :src="getContentTypeIcon(streamDetails.content_type)"
                    :style="
                      $vuetify.theme.current.dark
                        ? 'object-fit: contain;'
                        : 'object-fit: contain;filter: invert(100%);'
                    "
                  >
                  {{ streamDetails.sample_rate / 1000 }} kHz /
                  {{ streamDetails.bit_depth }} bits
                </div>

                <div
                  v-if="
                    activePlayerQueue &&
                      activePlayerQueue.crossfade_enabled
                  "
                  style="height: 50px; display: flex; align-items: center"
                >
                  <img
                    height="30"
                    width="50"
                    contain
                    src="@/assets/crossfade.png"
                    :style="
                      $vuetify.theme.current.dark
                        ? 'object-fit: contain;'
                        : 'object-fit: contain;filter: invert(100%);'
                    "
                  >
                  {{ $t("crossfade_enabled") }}
                </div>

                <div
                  v-if="streamDetails.gain_correct"
                  style="height: 50px; display: flex; align-items: center"
                >
                  <img
                    height="30"
                    width="50"
                    contain
                    src="@/assets/level.png"
                    :style="
                      $vuetify.theme.current.dark
                        ? 'object-fit: contain;'
                        : 'object-fit: contain;filter: invert(100%);'
                    "
                  >
                  {{ streamDetails.gain_correct }} dB
                </div>
              </v-list>
            </v-card>
          </v-menu>

          <!-- time details -->
          <div
            v-if="
              !$vuetify.display.mobile &&
                streamDetails &&
                curQueueItem && curQueueItem.media_item?.media_type !== MediaType.RADIO
            "
            class="mediadetails-time text-caption"
          >
            {{ playerCurTimeStr }} / {{ playerTotalTimeStr }}
          </div>
        </div>
      </template>
    </v-list-item>

    <!-- progress bar -->
    <div
      v-if="curQueueItem"
      style="width: 100%; height: 5px; padding-bottom: 20px; margin-top: -10px"
    >
      <v-slider
        :model-value="curQueueItemTime"
        height="3"
        color="primary"
        :min="0"
        :max="curQueueItem.duration"
        :thumb-size="4"
        style="margin-left: 0; margin-right: 0"
        :disabled="!curQueueItem || curQueueItem.media_item?.media_type != MediaType.TRACK"
        @update:model-value="
          api.queueCommandSeek(
            activePlayerQueue?.queue_id || '',
            Math.round($event)
          )
        "
      />
    </div>

    <!-- Control buttons -->
    <div class="mediacontrols">
      <!-- left side: playback buttons -->
      <div
        v-if="activePlayerQueue && activePlayerQueue.available"
        class="mediacontrols-left"
      >
        <!-- prev track -->
        <v-btn
          small
          icon
          variant="plain"
          :disabled="
            !activePlayerQueue ||
              !activePlayerQueue?.active ||
              activePlayerQueue?.items == 0
          "
          @click="api.queueCommandPrevious(activePlayerQueue!.queue_id)"
        >
          <v-icon icon="mdi-chevron-left" />
        </v-btn>
        <!-- play/pause button: only when MA queue is active -->
        <v-btn
          v-if="activePlayerQueue && activePlayerQueue?.active"
          icon
          x-large
          variant="plain"
          :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
          @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
        >
          <v-icon size="50">
            {{
              activePlayerQueue?.state == "playing" ? "mdi-pause" : "mdi-play"
            }}
          </v-icon>
        </v-btn>
        <!-- stop button: player is playing other source (not MA)-->
        <v-btn
          v-else-if="store.selectedPlayer?.state == PlayerState.PLAYING"
          icon
          x-large
          variant="plain"
          @click="api.queueCommandStop(activePlayerQueue!.queue_id)"
        >
          <v-icon size="50">
            mdi-stop
          </v-icon>
        </v-btn>
        <!-- play button: all other situations - resume the queue (disabled if queue is empty)-->
        <v-btn
          v-else
          icon
          x-large
          variant="plain"
          :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
          @click="api.queueCommandPlay(activePlayerQueue!.queue_id)"
        >
          <v-icon size="50">
            mdi-play
          </v-icon>
        </v-btn>
        <v-btn
          icon
          small
          variant="plain"
          :disabled="
            !activePlayerQueue ||
              !activePlayerQueue?.active ||
              activePlayerQueue?.items == 0
          "
          @click="api.queueCommandNext(activePlayerQueue!.queue_id)"
        >
          <v-icon icon="mdi-chevron-right" />
        </v-btn>
      </div>

      <!-- active player btn -->
      <v-btn
        icon
        variant="plain"
        class="mediacontrols-right"
        height="50"
        width="80"
        @click="store.showPlayersMenu = true"
      >
        <v-icon icon="mdi-speaker" />
        <div v-if="activePlayerQueue">
          {{ getPlayerName(api.players[activePlayerQueue.queue_id]) }}
        </div>
      </v-btn>
      <!-- active player volume -->
      <div v-if="!$vuetify.display.mobile && activePlayerQueue">
        <v-menu
          v-model="showVolume"
          location="bottom end"
          :close-on-content-click="false"
        >
          <template #activator="{ props }">
            <v-btn
              icon
              variant="plain"
              v-bind="props"
              class="mediacontrols-right"
              height="50"
              width="70"
            >
              <v-icon icon="mdi-volume-high" />
              <div>
                {{ Math.round(store.selectedPlayer?.group_volume || 0) }}
              </div>
            </v-btn>
          </template>

          <v-card min-width="300">
            <v-list
              style="overflow: hidden"
              lines="two"
            >
              <v-list-item density="compact">
                <template #prepend>
                  <v-icon
                    size="50"
                    :icon="
                      store.selectedPlayer!.group_childs.length > 0
                        ? 'mdi-speaker-multiple'
                        : 'mdi-speaker'
                    "
                    color="accent"
                    style="
                      padding-left: 0px;
                      padding-right: 0px;
                      margin-left: -10px;
                      margin-right: 10px;
                      width: 42px;
                      height: 50px;
                    "
                  />
                </template>

                <template #title>
                  <div class="text-subtitle-1">
                    <b>{{
                      store.selectedPlayer?.display_name.substring(0, 25)
                    }}</b>
                  </div>
                </template>

                <template #subtitle>
                  <div
                    :key="store.selectedPlayer?.state"
                    class="text-body-2"
                    style="line-height: 1em"
                  >
                    {{ $t("state." + store.selectedPlayer?.state) }}
                  </div>
                </template>
                <v-btn
                  variant="plain"
                  style="position: absolute; right: 0px; top: 0px"
                  icon="mdi-close"
                  dark
                  @click="showVolume = !showVolume"
                />
              </v-list-item>
              <v-divider />
              <VolumeControl
                v-if="store.selectedPlayer"
                :player="store.selectedPlayer"
              />
            </v-list>
          </v-card>
        </v-menu>
      </div>
      <!-- active player queue button -->
      <v-btn
        v-if="activePlayerQueue"
        text
        icon
        variant="plain"
        class="mediacontrols-right"
        height="50"
        width="70"
        @click="$router.push('/playerqueue/')"
      >
        <v-icon icon="mdi-playlist-music" />
        <div>{{ $t("queue") }}</div>
      </v-btn>
    </div>
  </v-footer>
</template>

<script setup lang="ts">
import { ref, computed, watch } from "vue";

import type { MediaItemType } from "../../plugins/api/interfaces";
import api from "@/plugins/api";
import { PlayerState, MediaType, ImageType } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import VolumeControl from "@/components/VolumeControl.vue";
import MediaItemThumb, {
  getImageThumbForItem,
} from "@/components/MediaItemThumb.vue";
import { formatDuration, getArtistsString, getPlayerName } from "@/utils";
import { useRouter } from "vue-router";
import {
  getContentTypeIcon,
  iconHiRes,
  iconFallback,
} from "@/components/ProviderIcons.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";

const router = useRouter();

// local refs
const fanartImage = ref();
const showVolume = ref(false);

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_queue];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});
const playerCurTimeStr = computed(() => {
  if (!curQueueItem.value) return "0:00";
  return formatDuration(curQueueItemTime.value);
});
const playerTotalTimeStr = computed(() => {
  if (!curQueueItem.value) return "0:00";
  const totalSecs = curQueueItem.value.duration;
  return formatDuration(totalSecs);
});
const streamDetails = computed(() => {
  return activePlayerQueue.value?.current_item?.streamdetails;
});
const curQueueItemTime = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.elapsed_time;
  return 0;
});

// methods
const itemClick = function (item: MediaItemType) {
  router.push({
    name: item.media_type,
    params: { itemId: item.item_id, provider: item.provider },
  });
};

// watchers
watch(
  () => curQueueItem.value?.queue_item_id,
  async () => {
    if (curQueueItem.value?.media_item) {
      fanartImage.value =
        (await getImageThumbForItem(
          curQueueItem.value.media_item,
          ImageType.FANART
        )) ||
        (await getImageThumbForItem(
          curQueueItem.value.media_item,
          ImageType.THUMB
        ));
    }
  }
);

</script>

<style scoped>
.bg-image {
  /* Add the blur effect */
  filter: blur(20px);
  -webkit-filter: blur(20px);
  /* Center and scale the image nicely */
  background-position: center;
  background-size: cover;
}

.mediadetails-time {
  float: right;
  width: auto;
  margin-top: 40px;

  position: absolute;
  right: 0px;
}
.mediadetails-streamdetails {
  float: right;
  width: 40px;
  right: -5px;
  margin-top: -15px;
  position: absolute;
  cursor: pointer;
}

.mediadetails-streamdetails .icon {
  opacity: 100;
}

.mediacontrols {
  display: inline-block;
  width: 100%;
  height: 55px;
  margin-top: 5px;
  margin-left: 0px;
  padding-bottom: 5px;
}
.mediacontrols-left {
  display: flex;
  width: auto;
  margin-left: -15px;
  padding-top: 0px;
  float: left;
  align-content: center;
}
.mediacontrols button {
  align-content: center;
}
.mediacontrols-right {
  float: right;
  padding-left: 10px;
  padding-right: 0px;
  margin-top: -12px;
}

.mediacontrols-right div {
  position: absolute;
  width: 80px;
  font-size: xx-small;
  margin-top: 50px;
  text-overflow: ellipsis;

  /* Required for text-overflow to do anything */
  white-space: nowrap;
  overflow: hidden;
  align-content: center;
}
</style>
