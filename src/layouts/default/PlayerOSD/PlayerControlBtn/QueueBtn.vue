<template>
  <Button
    variant="ghost"
    size="icon-lg"
    :aria-label="$t('tooltip.toggle_queue')"
    v-bind="$attrs"
    :title="$t('queue')"
    :aria-expanded="active ? 'true' : 'false'"
    :disabled="disabled"
    :class="{ 'text-primary': active }"
    @click="togglePlayerQueue"
  >
    <ListVideo :size="size" />
  </Button>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import { Button } from "@/components/ui/button";
import {
  isPlayerQueueControlDisabled,
  togglePlayerQueue,
} from "@/helpers/player_queue";
import { store } from "@/plugins/store";
import { ListVideo } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  size?: number;
}

withDefaults(defineProps<Props>(), {
  size: 20,
});

const active = computed(
  () => store.showFullscreenPlayer && store.showQueueItems,
);
const disabled = computed(isPlayerQueueControlDisabled);
</script>
