<template>
  <!-- active queue -->
  <Button
    v-if="props.isVisible"
    icon
    v-bind="props.icon"
    @click="
      store.showFullscreenPlayer = false;
      router.push('/playerqueue/');
    "
  >
    <v-icon icon="mdi-playlist-play" />
  </Button>
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import ResponsiveIcon, { ResponsiveIconProps } from '@/components/mods/ResponsiveIcon.vue';
import { getValueFromSources } from '@/helpers/utils';
import router from '@/plugins/router';

// properties
export interface Props {
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
});

// computed properties
const activePlayerQueue = computed(() => {
  if (store.selectedPlayer) {
    return api.queues[store.selectedPlayer.active_source];
  }
  return undefined;
});
</script>
