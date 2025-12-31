<template>
  <Button
    v-if="isVisible"
    v-bind="icon"
    :disabled="
      !store.activePlayerId ||
      (store.showFullscreenPlayer &&
        !store.curQueueItem &&
        !store.showQueueItems)
    "
    size="icon"
    variant="ghost-icon"
    @click="onClick"
  >
    <ListVideo
      :class="icon?.iconSize ? `size-${icon?.iconSize}` : 'size-4'"
      :style="{
        color:
          store.showFullscreenPlayer && store.showQueueItems
            ? 'var(--color-primary)'
            : '',
      }"
    />
  </Button>
</template>

<script setup lang="ts">
import {
  Button,
  type ButtonVariants as ButtonProps,
} from "@/components/ui/button";
import { store } from "@/plugins/store";
import { ListVideo } from "lucide-vue-next";

// properties
export interface Props {
  isVisible?: boolean;
  icon?: ButtonProps & { iconSize?: number };
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
