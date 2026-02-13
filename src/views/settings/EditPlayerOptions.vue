<template>
  <section class="edit-player-options"></section>
  <div v-for="option in playerOptionsSwitch" :key="option.key">
    {{ option.key }}
    {{ option.value }}
    <v-switch
      :model-value="option.value"
      color="primary"
      hide-details
      class="status-switch"
      @update:model-value="(value) => uiSetPlayerOption(option.key, value)"
    />
  </div>
  <div v-for="option in playerOptionsNumber" :key="option.key">
    <div v-if="typeof option.value === 'number'">
      {{ option.key }}
      {{ option.value }}
      <Slider
        :model-value="[option.value]"
        class="w-56"
        :step="option.step"
        :min="option.min_value"
        :max="option.max_value"
        @update:model-value="(value) => uiSetPlayerOption(option.key, value)"
      />
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

// global refs
// non read_only and...
// boolean
const playerOptionsSwitch = ref<PlayerOption[]>([]);
// float/ integer
const playerOptionsNumber = ref<PlayerOption[]>([]);
// string
const playerOptionsText = ref<PlayerOption[]>([]);
// options
const playerOptionsSelect = ref<PlayerOption[]>([]);
// read_only
const playerOptionsSensor = ref<PlayerOption[]>([]);

// props
const props = defineProps<{
  playerId?: string;
}>();

const getPlayerOptionsArray = (option: PlayerOption) => {
  let array: Ref<PlayerOption[]> | null = null;
  if (option.read_only) {
    array = playerOptionsSensor;
  } else {
    if (option.options && option.options.length > 0) {
      array = playerOptionsSelect;
    } else {
      switch (option.type) {
        case PlayerOptionType.BOOLEAN:
          array = playerOptionsSwitch;
          break;
        case PlayerOptionType.INTEGER || PlayerOptionType.FLOAT:
          array = playerOptionsNumber;
          break;
        case PlayerOptionType.STRING:
          array = playerOptionsText;
          break;
      }
    }
  }
  return array;
};

const loadOptionsOnEntry = async () => {
  if (!props.playerId) return;
  const player = await api.getPlayer(props.playerId);
  player.options.forEach((option) => {
    let array = getPlayerOptionsArray(option);
    if (array != null) {
      array.value.push(option);
    }
  });
};
loadOptionsOnEntry();

// subscribe to option updates
const unsub = api.subscribe(
  EventType.PLAYER_OPTIONS_UPDATED,
  // data: [old , new ]
  (evt: { data: [PlayerOption[], PlayerOption[]] }) => {
    evt.data[1].forEach((updatedOption) => {
      let array = getPlayerOptionsArray(updatedOption);
      // update array
      if (array == null) return;
      const optionIndex = array.value.findIndex(
        (prevOption) => prevOption.key === updatedOption.key,
      );
      if (optionIndex === -1) {
        // option not yet present
        array.value.push(updatedOption);
        return;
      }
      array.value[optionIndex] = updatedOption;
    });
  },
  props.playerId,
);
onBeforeUnmount(unsub);

// ui methods

const uiSetPlayerOption = async (
  key: string,
  value: PlayerOptionValueType | PlayerOptionValueType[] | null | undefined,
) => {
  if (!props.playerId || value === null || value == undefined) return;
  // we only have single numbers
  if (Array.isArray(value)) value = value[0];
  try {
    await api.playerCommandSetOption(props.playerId, key, value);
  } catch (error) {
    console.error("Error toggling option:", key);
  }
};
</script>
