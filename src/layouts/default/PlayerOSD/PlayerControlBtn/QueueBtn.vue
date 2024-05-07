<template>
  <!-- active queue -->
  <Button
    variant="icon"
    icon="mdi-playlist-play"
    :color="color ? color : ''"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { store } from '@/plugins/store';
import Button from '@/components/mods/Button.vue';

// properties
export interface Props {
  color?: string;
}
defineProps<Props>();

const onClick = function () {
  if (store.showFullscreenPlayer && store.showQueueItems) {
    store.showQueueItems = false;
  } else if (store.showFullscreenPlayer && !store.showQueueItems) {
    store.showQueueItems = true;
  } else {
    store.showQueueItems = true;
    store.showFullscreenPlayer = true;
  }
};
</script>
