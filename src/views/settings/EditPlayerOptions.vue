<template>
  <section class="edit-player-options"></section>
  <div v-if="props.playerId">
    <div v-for="option in playerOptions" :key="option.key">
      <PlayerOptionField :player-option="option" :player-id="props.playerId" />
    </div>
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import {
  EventType,
  PlayerOption,
  PlayerOptionType,
  PlayerOptionValueType,
} from "@/plugins/api/interfaces";
import { onBeforeUnmount, computed, ref, Ref } from "vue";
import Slider from "@/components/ui/slider/Slider.vue";
import PlayerOptionField from "./PlayerOptionField.vue";

// props
const props = defineProps<{
  playerId?: string;
}>();

// global refs
const playerOptions = ref<PlayerOption[]>([]);

// Full load on entry
const loadOptionsOnEntry = async () => {
  if (!props.playerId) return;
  const player = await api.getPlayer(props.playerId);
  playerOptions.value = player.options;
};
loadOptionsOnEntry();

// subscribe to option updates
const unsub = api.subscribe(
  EventType.PLAYER_OPTIONS_UPDATED,
  // data: [old , new ]
  (evt: { data: [PlayerOption[], PlayerOption[]] }) => {
    evt.data[1].forEach((updatedOption) => {
      const optionIndex = playerOptions.value.findIndex(
        (prevOption) => prevOption.key === updatedOption.key,
      );
      if (optionIndex === -1) {
        // option not yet present
        playerOptions.value.push(updatedOption);
        return;
      }
      playerOptions.value[optionIndex] = updatedOption;
    });
  },
  props.playerId,
);
onBeforeUnmount(unsub);
</script>
