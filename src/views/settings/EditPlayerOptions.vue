<template>
  <section class="edit-player-options"></section>
</template>
<script setup lang="ts">
import api from "@/plugins/api";
import { EventType, PlayerOption } from "@/plugins/api/interfaces";
import { onBeforeUnmount, reactive, computed, ref } from "vue";

// global refs
// reactive triggers ui update
const playerOptions = reactive<PlayerOption[]>([]);

// props
const props = defineProps<{
  playerId?: string;
}>();

const loadOptionsOnEntry = async () => {
  if (!props.playerId) return;
  const player = await api.getPlayer(props.playerId);
  player.options.forEach((option) => {
    playerOptions.push(option);
  });
};
loadOptionsOnEntry();

// subscribe to option updates
const unsub = api.subscribe(
  EventType.PLAYER_OPTIONS_UPDATED,
  (evt: { data: PlayerOption[] }) => {
    evt.data.forEach((updatedOption) => {
      const optionIndex = playerOptions.findIndex(
        (prevOption) => prevOption.key === updatedOption.key,
      );
      if (optionIndex === -1) {
        // option not yet present
        playerOptions.push(updatedOption);
        return;
      }
      playerOptions[optionIndex] = updatedOption;
    });
  },
  props.playerId,
);
onBeforeUnmount(unsub);
</script>
