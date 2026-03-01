<template>
  <Icon
    v-if="isVisible"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !store.activePlayerId ||
      (store.showFullscreenPlayer &&
        !store.curQueueItem &&
        !store.showQueueItems)
    "
    icon="mdi-playlist-play"
    :color="
      getValueFromSources(icon?.color, [
        [store.showFullscreenPlayer && store.showQueueItems, 'primary', ''],
      ])
    "
    variant="button"
    @click="onClick"
  />
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import { store } from "@/plugins/store";

// properties
export interface Props {
  isVisible?: boolean;
  icon?: IconProps;
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
