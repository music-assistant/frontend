<template>
  <section class="edit-player-options"></section>

  <!-- Settable options -->
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
import { watch } from "vue";

// props
const props = defineProps<{
  playerId?: string;
}>();

// global refs
const playerOptions = ref<PlayerOption[]>([]);

// Full load on entry
watch(
  () => props.playerId,
  async (val) => {
    if (val) {
      const player = await api.getPlayer(val);

      // sort for more consistency in UI experience
      let arrBool: PlayerOption[] = [];
      let arrNumber: PlayerOption[] = [];
      let arrString: PlayerOption[] = [];
      let arrSelect: PlayerOption[] = [];
      let arrSensor: PlayerOption[] = [];

      player.options.forEach((option) => {
        if (option.read_only) {
          arrSensor.push(option);
        } else if (option.options && option.options.length > 0) {
          arrSelect.push(option);
        } else if (option.type == PlayerOptionType.STRING) {
          arrString.push(option);
        } else if (option.type == PlayerOptionType.BOOLEAN) {
          arrBool.push(option);
        } else {
          arrNumber.push(option);
        }
      });

      let arrConcat: PlayerOption[] = [];

      playerOptions.value = arrConcat.concat(
        arrBool.sort((a, b) => a.key.localeCompare(b.key)),
        arrNumber.sort((a, b) => a.key.localeCompare(b.key)),
        arrString.sort((a, b) => a.key.localeCompare(b.key)),
        arrSelect.sort((a, b) => a.key.localeCompare(b.key)),
        arrSensor.sort((a, b) => a.key.localeCompare(b.key)),
      );
    }
  },
  { immediate: true },
);

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
