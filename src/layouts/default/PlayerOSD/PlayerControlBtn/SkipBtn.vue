<template>
  <!-- skip back / skip forward button -->
  <TransportBtn
    v-bind="$attrs"
    :icon-size="size"
    :disabled="isDisabled"
    :label="label"
    @click="api.queueCommandSkip(playerQueue!.queue_id, offset)"
  >
    <SkipIcon
      :direction="direction"
      :seconds="seconds"
      :size="size"
      :stroke-width="strokeWidth"
    />
  </TransportBtn>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import {
  SKIP_BACK_SECONDS,
  SKIP_FORWARD_SECONDS,
} from "@/composables/useSkipControls";
import SkipIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/SkipIcon.vue";
import TransportBtn from "@/layouts/default/PlayerOSD/PlayerControlBtn/TransportBtn.vue";
import api from "@/plugins/api";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  direction: "back" | "forward";
  size?: number;
  strokeWidth?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  size: 20,
  strokeWidth: 2,
});

const seconds = computed(() =>
  compProps.direction === "back" ? SKIP_BACK_SECONDS : SKIP_FORWARD_SECONDS,
);

const offset = computed(() =>
  compProps.direction === "back" ? -seconds.value : seconds.value,
);

const label = computed(() =>
  compProps.direction === "back"
    ? $t("skip_back_seconds", [seconds.value])
    : $t("skip_forward_seconds", [seconds.value]),
);

// stays enabled during a play action so quick repeated presses add up
const isDisabled = computed(
  () =>
    !compProps.playerQueue?.active ||
    !compProps.playerQueue.current_item?.duration,
);
</script>
