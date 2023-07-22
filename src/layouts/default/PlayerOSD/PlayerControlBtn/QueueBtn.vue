<template>
  <!-- active queue -->
  <Button
    variant="icon"
    @click="
      store.showFullscreenPlayer = false;
      router.push('/playerqueue/');
    "
  >
    <v-icon size="24" icon="mdi-playlist-play" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import router from '@/plugins/router';
import Button from '@/components/mods/Button.vue';

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>
