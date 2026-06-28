<template>
  <!-- shuffle button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !playerQueue || !playerQueue.active || isLoading || isInfiniteStream
    "
    :color="getValueFromSources(icon?.color, [[shuffleActive, 'primary', '']])"
    :title="shuffleTitle"
    variant="button"
    @click="
      api.queueCommandShuffle(
        playerQueue?.queue_id || '',
        playerQueue?.shuffle_enabled ? false : true,
      )
    "
  >
    <ShuffleIcon
      v-if="shuffleActive"
      :size="size"
      :smart="smartShuffleActive"
    />
    <IconArrowsRight v-else :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import ShuffleIcon from "@/layouts/default/PlayerOSD/PlayerControlBtn/ShuffleIcon.vue";
import { getValueFromSources } from "@/helpers/utils";
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { PlayerQueue } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { IconArrowsRight } from "@tabler/icons-vue";
import { computed } from "vue";

// properties
export interface Props {
  playerQueue: PlayerQueue | undefined;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  icon: undefined,
  size: 20,
});

const isLoading = computed(() => {
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});

const isInfiniteStream = computed(() =>
  isQueueInfiniteStream(compProps.playerQueue),
);

// Server-derived: shuffle is on with the per-queue smart-shuffle setting, or
// radio mode is active (the server sets this in both cases). Drives the
// twinkling smart-shuffle indicator.
const smartShuffleActive = computed(
  () => compProps.playerQueue?.smart_shuffle_active === true,
);

// Whether shuffle is in effect at all (plain or smart) — drives the icon choice
// and the primary highlight.
const shuffleActive = computed(
  () =>
    compProps.playerQueue?.shuffle_enabled === true || smartShuffleActive.value,
);

// State-aware tooltip reflecting plain vs smart shuffle.
const shuffleTitle = computed(() => {
  if (smartShuffleActive.value) return $t("shuffle_smart_active");
  return compProps.playerQueue?.shuffle_enabled
    ? $t("shuffle_disable")
    : $t("shuffle_enable");
});
</script>
