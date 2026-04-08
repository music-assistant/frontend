<template>
  <span
    class="player-name inline-flex items-center gap-1.5 whitespace-nowrap text-sm font-medium"
    :class="{
      'player-name--playing': isPlaying,
      'cursor-pointer': clickable,
    }"
    @click="handleClick"
  >
    <component :is="speakerIcon" :size="iconSize" :playing="isPlaying" />
    {{ displayName }}
  </span>
</template>

<script setup lang="ts">
import { computed } from "vue";
import SpeakerIcon from "@/components/icons/SpeakerIcon.vue";
import SpeakerGroupIcon from "@/components/icons/SpeakerGroupIcon.vue";
import { getPlayerName } from "@/helpers/utils";
import { store } from "@/plugins/store";
import {
  PlaybackState,
  PlayerType,
  type Player,
} from "@/plugins/api/interfaces";

interface Props {
  player?: Player;
  iconSize?: number;
  truncate?: number;
  clickable?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  player: undefined,
  iconSize: 24,
  truncate: 26,
  clickable: false,
});

const speakerIcon = computed(() => {
  const p = props.player ?? store.activePlayer;
  if (!p) return SpeakerIcon;
  if (
    p.type === PlayerType.GROUP ||
    (p.type === PlayerType.PLAYER && p.group_members.length > 0)
  ) {
    return SpeakerGroupIcon;
  }
  return SpeakerIcon;
});

const displayName = computed(() => {
  const p = props.player ?? store.activePlayer;
  if (!p) return "";
  return getPlayerName(p, props.truncate);
});

const isPlaying = computed(() => {
  const p = props.player ?? store.activePlayer;
  if (!p) return false;
  return p.playback_state === PlaybackState.PLAYING;
});

function handleClick() {
  if (props.clickable) {
    store.showPlayersMenu = true;
  }
}
</script>

<style scoped>
.player-name--playing :deep(svg) {
  color: rgb(var(--v-theme-primary));
}
</style>
