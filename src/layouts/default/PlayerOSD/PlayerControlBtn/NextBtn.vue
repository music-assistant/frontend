<template>
  <!-- next button -->
  <Icon
    v-if="isVisible && player && showNextPrev"
    v-bind="{ ...icon, ...$attrs }"
    :disabled="!canNext || isLoading"
    :aria-label="$t('next_track')"
    :title="$t('next_track')"
    variant="button"
    @click="api.playerCommandNext(player.player_id)"
  >
    <SkipForward :size="size" />
  </Icon>
</template>

<script setup lang="ts">
defineOptions({ inheritAttrs: false });
import Icon, { IconProps } from "@/components/Icon.vue";
import api from "@/plugins/api";
import { Player, PlayerFeature, PlayerQueue } from "@/plugins/api/interfaces";
import { useActiveAudioSource } from "@/composables/activeAudioSource";
import { useActiveSource } from "@/composables/activeSource";
import { computed, toRef } from "vue";
import { SkipForward } from "lucide-vue-next";

// properties
export interface Props {
  player: Player | undefined;
  playerQueue?: PlayerQueue;
  isVisible?: boolean;
  icon?: IconProps;
  size?: number;
}
const compProps = withDefaults(defineProps<Props>(), {
  playerQueue: undefined,
  isVisible: true,
  icon: undefined,
  size: 20,
});

const { activeSource } = useActiveSource(toRef(compProps, "player"));
const { activeAudioSource } = useActiveAudioSource(toRef(compProps, "player"));

// Hide the button when the active queue item is an AudioSource without
// next/previous support.
const showNextPrev = computed(() =>
  activeAudioSource.value ? activeAudioSource.value.can_next_previous : true,
);

const queueHasNext = computed(() => {
  if (!compProps.playerQueue?.active) return false;
  return (
    (compProps.playerQueue.current_index || 0) < compProps.playerQueue.items - 1
  );
});

const playerHasNext = computed(() => {
  if (!compProps.player) return false;
  if (compProps.playerQueue?.active) return false;
  if (!compProps.player.current_media) return false;
  return compProps.player.supported_features.includes(
    PlayerFeature.NEXT_PREVIOUS,
  );
});

const canNext = computed(() => {
  // AudioSource queue items carry their own capability flags
  if (activeAudioSource.value) {
    return activeAudioSource.value.can_next_previous;
  }
  // Check if active source can next/previous
  if (activeSource.value) {
    return activeSource.value.can_next_previous;
  }
  // Fall back to queue or player capabilities
  return queueHasNext.value || playerHasNext.value;
});

const isLoading = computed(() => {
  if (!compProps.player) return false;
  return (
    compProps.playerQueue?.extra_attributes?.play_action_in_progress === true
  );
});
</script>
