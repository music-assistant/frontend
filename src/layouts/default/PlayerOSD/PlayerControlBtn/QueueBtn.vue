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
    :color="
      getValueFromSources(icon?.color, [
        [store.showFullscreenPlayer && store.showQueueItems, 'primary', ''],
      ])
    "
    variant="button"
    @click="onClick"
  >
    <ListVideo :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import { getValueFromSources } from "@/helpers/utils";
import { store } from "@/plugins/store";
import { ListVideo } from "lucide-vue-next";

// properties
export interface Props {
  isVisible?: boolean;
  icon?: IconProps;
  size?: number;
}

withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
  size: 20,
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
