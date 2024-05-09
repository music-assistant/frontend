<template>
  <ResponsiveIcon
    v-if="props.isVisible"
    v-bind="props.icon"
    :disabled="
      !store.activePlayerQueue ||
      !store.activePlayerQueue?.active ||
      store.activePlayerQueue?.items == 0
    "
    icon="mdi-playlist-play"
    :type="'btn'"
    :badge="store.showFullscreenPlayer && store.showQueueItems"
    @click="onClick"
  />
</template>

<script setup lang="ts">
import { store } from '@/plugins/store';
import ResponsiveIcon, {
  ResponsiveIconProps,
} from '@/components/mods/ResponsiveIcon.vue';

// properties
export interface Props {
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}

const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
});

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
