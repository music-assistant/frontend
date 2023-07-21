<template>
  <v-card height="auto">
    <!-- now playing media -->
    <ListItem lines="two" style="padding: 0px; height: 100%">
      <template #prepend>
        <div style="height: 100%; width: 64px; margin-right: 15px">
          <MediaItemThumb v-if="curQueueItem" :item="curQueueItem.media_item || curQueueItem" />
          <v-img v-else :src="props.image || iconFallback" style="opacity: 50%" />
        </div>
      </template>

      <!-- title -->
      <template #title>
        <div>{{ curQueueItem?.media_item?.name || props.title }}</div>
      </template>
      <!-- subtitle -->
      <template #subtitle>
        <h6 v-if="curQueueItem?.media_item">
          {{ isTrack(curQueueItem.media_item) ? getArtistsString(curQueueItem.media_item.artists) : props.subtitle }}
        </h6>
        <h6>{{ activePlayerQueue?.display_name || props.text }}</h6>
      </template>

      <!-- append -->
      <template #append>
        <!-- format -->
        <Button
          v-if="activePlayerQueue && activePlayerQueue?.active"
          icon
          :disabled="activePlayerQueue && activePlayerQueue?.items == 0"
          @click="api.queueCommandPlayPause(activePlayerQueue!.queue_id)"
        >
          <v-icon style="margin-inline-start: 0px" :size="35">
            {{ activePlayerQueue?.state == 'playing' ? 'mdi-pause-circle-outline' : 'mdi-play-circle-outline' }}
          </v-icon>
        </Button>
      </template>
    </ListItem>
  </v-card>
</template>

<script setup lang="ts">
import { ref, computed, watch } from 'vue';

import api from '@/plugins/api';
import { ImageType, Track, Radio } from '@/plugins/api/interfaces';
import MediaItemThumb, { getImageThumbForItem } from '@/components/MediaItemThumb.vue';
import { iconFallback } from '@/components/QualityDetailsBtn.vue';
import { getArtistsString } from '@/utils';
import Button from '@/components/mods/Button.vue';
import ListItem from '@/components/mods/ListItem.vue';

// properties
export interface Props {
  title?: string;
  subtitle?: string;
  text?: string;
  image?: string;
  queueId?: string;
}

const props = withDefaults(defineProps<Props>(), {
  title: 'Title',
  subtitle: 'Subtitle',
  text: 'Text',
  image: iconFallback,
  queueId: '',
});

// local refs
const fanartImage = ref();

// computed properties
const activePlayerQueue = computed(() => {
  if (props.queueId) {
    return api.queues[props.queueId];
  }
  return undefined;
});
const curQueueItem = computed(() => {
  if (activePlayerQueue.value) return activePlayerQueue.value.current_item;
  return undefined;
});

// watchers
watch(
  () => curQueueItem.value?.queue_item_id,
  async () => {
    if (curQueueItem.value?.media_item) {
      fanartImage.value =
        getImageThumbForItem(curQueueItem.value.media_item, ImageType.FANART) ||
        getImageThumbForItem(curQueueItem.value.media_item, ImageType.THUMB);
    }
  },
);

//functions
function isTrack(media_item: Track | Radio): media_item is Track {
  return (media_item as Track).artists !== undefined;
}
</script>
