<template>
  <Icon
    v-if="isVisible"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="!canSkip"
    variant="button"
    :title="$t('skip_forward_seconds', [skipAmount])"
    :aria-label="$t('skip_forward_seconds', [skipAmount])"
    @click="skip"
  >
    <FastForward :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { FastForward } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  playerQueue: PlayerQueue | undefined;
  skipAmount: number;
  isVisible?: boolean;
  icon?: IconProps;
  size?: number;
}
const props = withDefaults(defineProps<Props>(), {
  isVisible: true,
  icon: undefined,
  size: 20,
});

const canSkip = computed(
  () => !!props.playerQueue?.active && !!props.playerQueue.current_item,
);

function skip() {
  if (canSkip.value) {
    api.queueCommandSkip(props.playerQueue!.queue_id, props.skipAmount);
  }
}
</script>
