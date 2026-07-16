<template>
  <div class="overflow-hidden" @click.stop>
    <div
      v-if="showVolumeControl"
      class="flex min-h-8 items-center gap-1 opacity-75"
    >
      <PlayerVolume
        :player="player"
        :allow-wheel="allowWheel"
        :show-volume-level="!canExpandChildVolumes"
        :prefer-group-volume="true"
        :enable-popout="false"
        :request-expand-on-group-tap="canExpandChildVolumes"
        width="100%"
        @toggle-group-expansion="emit('toggle-child-volumes', player)"
      />
      <Button
        v-if="canExpandChildVolumes"
        variant="ghost"
        size="icon-xs"
        class="size-8 shrink-0"
        :disabled="!player.available"
        :aria-label="$t('tooltip.toggle_subplayers')"
        :aria-expanded="showChildVolumes"
        @click.stop="emit('toggle-child-volumes', player)"
      >
        <ChevronUp v-if="showChildVolumes" class="size-4" />
        <ChevronDown v-else class="size-4" />
      </Button>
    </div>

    <PlayerChildVolumes
      v-if="
        showVolumeControl && showChildVolumes && childVolumePlayers.length > 0
      "
      :players="childVolumePlayers"
      :allow-wheel="allowWheel"
    />
    <PlayerGroupMembers
      v-if="showMemberControls"
      :player="player"
      :members="groupMembers"
    />
  </div>
</template>

<script setup lang="ts">
import PlayerChildVolumes from "@/components/PlayerChildVolumes.vue";
import PlayerGroupMembers from "@/components/PlayerGroupMembers.vue";
import { Button } from "@/components/ui/button";
import PlayerVolume from "@/layouts/default/PlayerOSD/PlayerVolume.vue";
import { api } from "@/plugins/api";
import {
  type Player,
  PLAYER_CONTROL_NONE,
  PlayerType,
} from "@/plugins/api/interfaces";
import { ChevronDown, ChevronUp } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  player: Player;
  showMemberControls?: boolean;
  showChildVolumes?: boolean;
  showVolumeControl?: boolean;
  allowWheel?: boolean;
}

const props = defineProps<Props>();
const emit = defineEmits<{
  (event: "toggle-child-volumes", player: Player): void;
}>();

const volumePlayers = computed(() => {
  const playerIds = new Set(props.player.group_members);
  const hasGroupMembers =
    props.player.type === PlayerType.GROUP
      ? playerIds.size > 0
      : [...playerIds].some((playerId) => playerId !== props.player.player_id);
  if (props.player.type !== PlayerType.GROUP) {
    if (hasGroupMembers) {
      playerIds.add(props.player.player_id);
    } else {
      playerIds.delete(props.player.player_id);
    }
  }
  const players = [...playerIds]
    .map((playerId) => api.players[playerId])
    .filter((player): player is Player => player?.available === true);
  return players.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    }),
  );
});

const groupMembers = computed(() =>
  volumePlayers.value.filter(
    (player) => player.player_id !== props.player.player_id,
  ),
);

const childVolumePlayers = computed(() =>
  volumePlayers.value.filter(
    (player) => player.volume_control !== PLAYER_CONTROL_NONE,
  ),
);

const canExpandChildVolumes = computed(
  () => childVolumePlayers.value.length > 0,
);
</script>
