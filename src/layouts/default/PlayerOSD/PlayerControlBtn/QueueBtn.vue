<template>
  <ResponsiveIcon
    v-if="isVisible"
    v-bind="icon"
    :disabled="!store.activePlayerId"
    icon="mdi-playlist-play"
    :color="
      getValueFromSources(icon?.color, [
        [store.showFullscreenPlayer && store.showQueueItems, 'primary', ''],
      ])
    "
    :type="'btn'"
    @clicked="onClick"
  />
</template>

<script setup lang="ts">
import { store } from '@/plugins/store';
import ResponsiveIcon, {
  ResponsiveIconProps,
} from '@/components/mods/ResponsiveIcon.vue';
import { getValueFromSources } from '@/helpers/utils';

// properties
export interface Props {
  isVisible?: boolean;
  icon?: ResponsiveIconProps;
}

withDefaults(defineProps<Props>(), {
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
