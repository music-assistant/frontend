<template>
  <div v-if="candidates.length > 0">
    <Separator class="my-2" />
    <p class="text-muted-foreground px-2 pb-1 text-xs font-medium">
      {{ $t("settings.group_members") }}
    </p>
    <label
      v-for="candidate in candidates"
      :key="candidate.player_id"
      :for="getCheckboxId(candidate)"
      class="player-group-member flex min-h-10 items-center gap-2 rounded-md pr-2 transition-colors"
      :class="{
        'bg-primary/10': isGroupMember(candidate),
        'hover:bg-accent/50 cursor-pointer': !isRequiredMember(candidate),
        'cursor-not-allowed': isRequiredMember(candidate),
      }"
    >
      <span
        class="player-group-member-icon flex h-6 w-[30px] shrink-0 items-center justify-center"
      >
        <PlayerIcon
          :icon="candidate.icon"
          :size="18"
          class="text-muted-foreground"
          :class="{ 'opacity-50': candidate.powered === false }"
        />
      </span>
      <span class="min-w-0 flex-1 truncate text-xs font-medium">
        {{ candidate.name }}
      </span>
      <Checkbox
        :id="getCheckboxId(candidate)"
        :model-value="isGroupMember(candidate)"
        :disabled="isRequiredMember(candidate)"
        :aria-label="candidate.name"
        class="border-muted-foreground/70 bg-background/70 size-5 border-2 shadow-sm"
        @update:model-value="
          updateGroupMember(candidate.player_id, $event === true)
        "
      />
    </label>
  </div>
</template>

<script setup lang="ts">
import PlayerIcon from "@/components/PlayerIcon.vue";
import { Checkbox } from "@/components/ui/checkbox";
import { Separator } from "@/components/ui/separator";
import { groupMemberPickerVisible } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  type Player,
  PlayerFeature,
  PlayerType,
} from "@/plugins/api/interfaces";
import { computed, ref } from "vue";

const props = defineProps<{
  player: Player;
  members: Player[];
}>();

const playersToAdd = ref<string[]>([]);
const playersToRemove = ref<string[]>([]);
const timeoutId = ref<ReturnType<typeof setTimeout>>();

const candidates = computed(() => {
  const players = [...props.members];
  const playerIds = new Set(players.map((player) => player.player_id));
  if (!props.player.supported_features.includes(PlayerFeature.SET_MEMBERS)) {
    return sortPlayers(players);
  }

  for (const player of Object.values(api.players)) {
    if (
      player.player_id === props.player.player_id ||
      playerIds.has(player.player_id) ||
      !canGroupWithPlayer(player) ||
      !player.available ||
      !groupMemberPickerVisible(player) ||
      player.type === PlayerType.GROUP ||
      (player.active_group && player.active_group !== props.player.player_id)
    ) {
      continue;
    }
    players.push(player);
    playerIds.add(player.player_id);
  }

  return sortPlayers(players);
});

function getCheckboxId(player: Player) {
  return `group-member-${props.player.player_id}-${player.player_id}`;
}

function isGroupMember(player: Player) {
  return props.player.group_members.includes(player.player_id);
}

function isRequiredMember(player: Player) {
  return (
    props.player.static_group_members.includes(player.player_id) &&
    isGroupMember(player)
  );
}

function canGroupWithPlayer(player: Player) {
  return (
    props.player.can_group_with.includes(player.player_id) ||
    // Providers remain supported until the server always supplies player IDs.
    props.player.can_group_with.includes(player.provider)
  );
}

function sortPlayers(players: Player[]) {
  return players.sort((left, right) =>
    left.name.localeCompare(right.name, undefined, {
      sensitivity: "base",
    }),
  );
}

function updateGroupMember(playerId: string, selected: boolean) {
  const parentPlayerId = props.player.player_id;

  if (selected) {
    playersToRemove.value = playersToRemove.value.filter(
      (id) => id !== playerId,
    );
    if (!playersToAdd.value.includes(playerId)) {
      playersToAdd.value.push(playerId);
    }
    if (!api.players[parentPlayerId].group_members.includes(playerId)) {
      api.players[parentPlayerId].group_members.push(playerId);
    }
  } else {
    playersToAdd.value = playersToAdd.value.filter((id) => id !== playerId);
    if (!playersToRemove.value.includes(playerId)) {
      playersToRemove.value.push(playerId);
    }
    const remainingPlayerIds = api.players[parentPlayerId].group_members.filter(
      (id) => id !== playerId,
    );
    api.players[parentPlayerId].group_members =
      props.player.type !== PlayerType.GROUP &&
      remainingPlayerIds.length === 1 &&
      remainingPlayerIds[0] === parentPlayerId
        ? []
        : remainingPlayerIds;
  }

  scheduleMemberUpdate();
}

function scheduleMemberUpdate() {
  if (timeoutId.value) clearTimeout(timeoutId.value);
  if (playersToAdd.value.length === 0 && playersToRemove.value.length === 0) {
    return;
  }

  timeoutId.value = setTimeout(() => {
    const playerIdsToAdd = [...playersToAdd.value];
    const playerIdsToRemove = [...playersToRemove.value];
    playersToAdd.value = [];
    playersToRemove.value = [];
    timeoutId.value = undefined;

    api
      .playerCommandSetMembers(
        props.player.player_id,
        playerIdsToAdd.length ? playerIdsToAdd : undefined,
        playerIdsToRemove.length ? playerIdsToRemove : undefined,
      )
      .catch(restorePlayer);
  }, 500);
}

async function restorePlayer() {
  const restoredPlayer = await api.getPlayer(props.player.player_id);
  for (const playerId of playersToAdd.value) {
    if (!restoredPlayer.group_members.includes(playerId)) {
      restoredPlayer.group_members.push(playerId);
    }
  }
  restoredPlayer.group_members = restoredPlayer.group_members.filter(
    (playerId) => !playersToRemove.value.includes(playerId),
  );
  api.players[props.player.player_id] = restoredPlayer;
}
</script>
