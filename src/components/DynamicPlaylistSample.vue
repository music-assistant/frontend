<template>
  <div>
    <div class="d-flex align-center ga-3 px-4 pt-4">
      <div class="dynamic-badge d-flex align-center justify-center rounded-lg">
        <v-icon icon="mdi-shuffle-variant" size="22" color="primary" />
      </div>
      <div>
        <div class="text-h6">
          {{ $t("smart_playlist.dynamic_sample_heading") }}
        </div>
        <div class="text-body-2 text-medium-emphasis">
          {{ $t("smart_playlist.dynamic_sample_note") }}
        </div>
      </div>
    </div>

    <div class="px-4 pt-4">
      <Separator />
    </div>

    <div class="px-2 pt-5 pb-2">
      <template v-if="loading">
        <ListViewSkeleton v-for="n in 8" :key="'skeleton-list-' + n" />
      </template>

      <template v-else-if="tracks.length">
        <ListviewItem
          v-for="item in tracks"
          :key="item.uri"
          :item="item"
          :is-selected="false"
          :is-available="itemIsAvailable(item)"
          :is-playing="isPlaying(item)"
          :show-track-number="false"
          :show-provider="false"
          :show-favorite="false"
          :show-menu="item.is_playable"
        />
      </template>

      <v-alert v-else color="transparent" class="ma-2">
        {{ $t("no_content") }}
      </v-alert>
    </div>
  </div>
</template>

<script setup lang="ts">
import ListviewItem from "@/components/ListviewItem.vue";
import ListViewSkeleton from "@/components/skeletons/ListViewSkeleton.vue";
import { Separator } from "@/components/ui/separator";
import { api } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  PlaybackState,
  type Audiobook,
  type MediaItemType,
  type Playlist,
  type PodcastEpisode,
  type Radio,
  type Track,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ref, watch } from "vue";

export interface Props {
  itemDetails: Playlist;
  provider: string;
}
const props = defineProps<Props>();

const loading = ref(true);
const tracks = ref<(Track | Radio | PodcastEpisode | Audiobook)[]>([]);

const loadSample = async function () {
  loading.value = true;
  try {
    // request a fresh evaluation: the overview should show a current sample rather than
    // a (possibly stale/empty) cached browse result.
    const result = await api.getPlaylistTracks(
      props.itemDetails.item_id,
      props.provider,
      true,
    );
    // the provider returns a bounded sample for dynamic playlists; cap defensively
    tracks.value = result.slice(0, 25);
  } catch {
    tracks.value = [];
  } finally {
    loading.value = false;
  }
};

// reflect the currently playing track, like the rest of the app
const isPlaying = function (item: MediaItemType): boolean {
  if (store.activePlayer?.playback_state != PlaybackState.PLAYING) return false;
  const current = store.curQueueItem?.media_item;
  if (!current) return false;
  return item.item_id === current.item_id;
};

watch(
  () => [props.itemDetails.item_id, props.provider],
  (val) => {
    if (val[0]) loadSample();
  },
  { immediate: true },
);
</script>

<style scoped>
.dynamic-badge {
  width: 40px;
  height: 40px;
  flex-shrink: 0;
  background: rgba(var(--v-theme-primary), 0.12);
}

.col-2 {
  width: 50%;
  max-width: 50%;
  flex-basis: 50%;
  padding: 8px;
}
.col-3 {
  width: 33.3%;
  max-width: 33.3%;
  flex-basis: 33.3%;
  padding: 8px;
}
.col-4 {
  width: 25%;
  max-width: 25%;
  flex-basis: 25%;
  padding: 8px;
}
.col-5 {
  width: 20%;
  max-width: 20%;
  flex-basis: 20%;
  padding: 8px;
}
.col-6 {
  width: 16.6%;
  max-width: 16.6%;
  flex-basis: 16.6%;
  padding: 8px;
}
.col-7 {
  width: 14.2%;
  max-width: 14.2%;
  flex-basis: 14.2%;
  padding: 8px;
}
.col-8 {
  width: 12.5%;
  max-width: 12.5%;
  flex-basis: 12.5%;
  padding: 8px;
}
.col-9 {
  width: 11.1%;
  max-width: 11.1%;
  flex-basis: 11.1%;
  padding: 8px;
}
.col-10 {
  width: 10%;
  max-width: 10%;
  flex-basis: 10%;
  padding: 8px;
}
</style>
