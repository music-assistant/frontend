<template>
  <!-- shuffle button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    :disabled="
      !playerQueue ||
      !playerQueue.active ||
      isLoading ||
      isInfiniteStream ||
      isDynamic
    "
    :color="getValueFromSources(icon?.color, [[shuffleActive, 'primary', '']])"
    :title="shuffleTitle"
    :data-dynamic="isDynamic || undefined"
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

// In dynamic mode the queue manages its own ordering (smart shuffle is implied),
// so manual shuffle toggling doesn't apply.
const isDynamic = computed(() => compProps.playerQueue?.is_dynamic === true);

// Server-derived: shuffle is on with the per-queue smart-shuffle setting, or
// radio mode is active (the server sets this in both cases). Drives the
// twinkling smart-shuffle indicator.
const smartShuffleActive = computed(
  () => compProps.playerQueue?.smart_shuffle_active === true,
);

// Whether shuffle is enabled — drives the icon choice and the primary
// highlight. The backend owns the smart/plain relationship, so this stays a
// pure read of shuffle_enabled (smart state is surfaced via smartShuffleActive).
const shuffleActive = computed(
  () => compProps.playerQueue?.shuffle_enabled === true,
);

// State-aware tooltip. In dynamic mode the button is disabled and shuffle is
// managed by the queue, so explain that rather than offering a toggle.
const shuffleTitle = computed(() => {
  if (isDynamic.value) return $t("shuffle_dynamic_active");
  if (smartShuffleActive.value) return $t("shuffle_smart_active");
  return compProps.playerQueue?.shuffle_enabled
    ? $t("shuffle_disable")
    : $t("shuffle_enable");
});
</script>

<style scoped>
/* Disabled icons drop pointer events (so no tooltip), but in dynamic mode we
   want the title to explain why shuffle is unavailable. Re-enable hover just for
   that case; the Icon still guards the click itself. */
.icon-container--disabled[data-dynamic] {
  pointer-events: auto;
}
</style>
