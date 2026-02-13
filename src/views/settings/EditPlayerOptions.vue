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
  <div v-for="option in playerOptionsSelect" :key="option.key">
    {{ option.key }}
    {{ option.value }}
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

// props
const props = defineProps<{
  playerId?: string;
}>();

// global refs
const playerOptions = ref<PlayerOption[]>([]);

// computed properties
// helper function
const getOptions = (
  type: PlayerOptionType[],
  readOnly: boolean,
  hasOptions: boolean = false,
) => {
  let array: PlayerOption[] = [];
  playerOptions.value.forEach((option) => {
    if (option.options && option.options.length > 0) {
      if (
        hasOptions &&
        option.read_only === readOnly &&
        type.includes(option.type)
      ) {
        // has suboptions
        array.push(option);
      }
    } else if (
      !hasOptions &&
      option.read_only === readOnly &&
      type.includes(option.type)
    ) {
      // no sub options
      array.push(option);
    }
  });
  // sort them to make sure, that we always have the options in the same order.
  array = array.sort((a, b) => b.key.localeCompare(a.key));
  return array;
};

const playerOptionsSwitch = computed(() => {
  return getOptions([PlayerOptionType.BOOLEAN], false);
});

const playerOptionsNumber = computed(() => {
  return getOptions([PlayerOptionType.INTEGER, PlayerOptionType.FLOAT], false);
});

const playerOptionsText = computed(() => {
  return getOptions([PlayerOptionType.STRING], false);
});

const playerOptionsSelect = computed(() => {
  return getOptions(
    [
      PlayerOptionType.BOOLEAN,
      PlayerOptionType.INTEGER,
      PlayerOptionType.FLOAT,
      PlayerOptionType.STRING,
    ],
    false,
    true,
  );
});

const playerOptionsSensor = computed(() => {
  return getOptions(
    [
      PlayerOptionType.BOOLEAN,
      PlayerOptionType.INTEGER,
      PlayerOptionType.FLOAT,
      PlayerOptionType.STRING,
    ],
    true,
  );
});

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
