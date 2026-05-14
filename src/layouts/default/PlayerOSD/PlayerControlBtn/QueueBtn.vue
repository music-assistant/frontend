<template>
  <Button
    v-if="isVisible"
    variant="icon"
    :ripple="false"
    icon
    v-bind="$attrs"
    :disabled="
      !store.activePlayerId ||
      (store.showFullscreenPlayer &&
        !store.curQueueItem &&
        !store.showQueueItems)
    "
    :color="activeColor"
    @click="onClick"
  >
    <ListVideo :size="size" />
  </Button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Button from "@/components/Button.vue";
import { store } from "@/plugins/store";
import { ListVideo } from "lucide-vue-next";
import { computed } from "vue";

export interface Props {
  isVisible?: boolean;
  size?: number;
}

withDefaults(defineProps<Props>(), {
  isVisible: true,
  size: 20,
});

const activeColor = computed(() =>
  store.showFullscreenPlayer && store.showQueueItems ? "primary" : undefined,
);

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
