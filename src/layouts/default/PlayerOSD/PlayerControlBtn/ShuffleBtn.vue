<template>
  <!-- shuffle button -->
  <Icon
    v-bind="{ ...icon, ...$attrs }"
    :disabled="isDisabled"
    :color="getValueFromSources(icon?.color, [[shuffleActive, 'primary', '']])"
    :title="shuffleTitle"
    :aria-label="shuffleTitle"
    :aria-pressed="shuffleActive ? 'true' : 'false'"
    :data-dynamic="isDynamic || undefined"
    variant="button"
    @click="toggleShuffle"
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
import { useExternalSource } from "@/composables/externalSource";
import { resolveActiveSourceId } from "@/composables/activeSource";
import api from "@/plugins/api";
import { isQueueInfiniteStream } from "@/plugins/api/helpers";
import { Player, PlayerQueue } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { IconArrowsRight } from "@tabler/icons-vue";
import { computed, toRef } from "vue";

// properties
export interface Props {
  player: Player | undefined;
  // the queue playing on this player, i.e. resolvePlayerQueue(player) — the
  // state shown and the source the command is aimed at are both derived from
  // this pair
  playerQueue: PlayerQueue | undefined;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  icon: undefined,
  size: 20,
});

const { externalSource } = useExternalSource(
  toRef(compProps, "player"),
  toRef(compProps, "playerQueue"),
);

// The state shown comes from an external source that orders its own session;
// one that cannot leaves the button disabled rather than silently inert.
const orderingSource = computed(() =>
  externalSource.value?.can_shuffle ? externalSource.value : undefined,
);

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
// highlight. Read from whichever side is playing; the backend owns the
// smart/plain relationship, so smart state is surfaced via smartShuffleActive.
const shuffleActive = computed(() =>
  orderingSource.value
    ? orderingSource.value.shuffle_enabled === true
    : compProps.playerQueue?.shuffle_enabled === true,
);

// An external source needs no queue to act on, so only the queue path carries
// the queue's own reasons for being unavailable.
const isDisabled = computed(() => {
  if (isLoading.value) return true;
  // the command is addressed to the player, so there is nothing to send without one
  if (!compProps.player) return true;
  if (orderingSource.value) return false;
  return (
    !compProps.playerQueue ||
    !compProps.playerQueue.active ||
    isInfiniteStream.value ||
    isDynamic.value
  );
});

// State-aware tooltip. In dynamic mode the button is disabled and shuffle is
// managed by the queue, so explain that rather than offering a toggle.
const shuffleTitle = computed(() => {
  if (isDynamic.value) return $t("shuffle_dynamic_active");
  if (smartShuffleActive.value) return $t("shuffle_smart_active");
  return shuffleActive.value ? $t("shuffle_disable") : $t("shuffle_enable");
});

// The command names the source the state being inverted was read from, so it
// applies to whatever is playing — the live session or the queue — and never to
// something that took the player in between.
function toggleShuffle() {
  if (!compProps.player) return;
  api.playerCommandShuffle(
    compProps.player.player_id,
    !shuffleActive.value,
    resolveActiveSourceId(compProps.player),
  );
}
</script>

<style scoped>
/* Disabled icons drop pointer events (so no tooltip), but in dynamic mode we
   want the title to explain why shuffle is unavailable. Re-enable hover just for
   that case; the Icon still guards the click itself. */
.icon-container--disabled[data-dynamic] {
  pointer-events: auto;
}
</style>
