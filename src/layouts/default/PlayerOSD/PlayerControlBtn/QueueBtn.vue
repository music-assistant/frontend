<template>
  <Button
    variant="ghost"
    size="icon-lg"
    :aria-label="$t('tooltip.toggle_queue')"
    v-bind="$attrs"
    :disabled="disabled"
    :class="{ 'text-primary': active }"
    @click="togglePlayerQueue"
  >
    <template v-if="playerBar">
      <span class="player-bar-action-icon">
        <ListVideo :size="size" />
      </span>
      <span class="player-bar-action-label" aria-hidden="true">&nbsp;</span>
    </template>
    <ListVideo v-else :size="size" />
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
  playerBar?: boolean;
  size?: number;
}

withDefaults(defineProps<Props>(), {
  playerBar: false,
  size: 20,
});

const active = computed(
  () => store.showFullscreenPlayer && store.showQueueItems,
);
const disabled = computed(isPlayerQueueControlDisabled);
</script>
