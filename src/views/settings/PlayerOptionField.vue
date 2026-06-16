<template>
  <!-- drop down for multiple options -->
  <div v-if="playerOption.options && playerOption.options.length > 0">
    <v-select
      :model-value="playerOption.value"
      :items="selectOptions"
      :label="playerOption.name"
      variant="outlined"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>

  <!-- toggle for boolean values -->
  <div v-else-if="playerOption.type === PlayerOptionType.BOOLEAN">
    <v-switch
      :label="playerOption.name"
      :model-value="playerOption.value"
      :readonly="playerOption.read_only"
      hide-details
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>

  <!-- slider for int/ float with min/max -->
  <div
    v-else-if="
      (playerOption.type === PlayerOptionType.INTEGER ||
        playerOption.type === PlayerOptionType.FLOAT) &&
      playerOption.min_value &&
      playerOption.max_value &&
      playerOption.step
    "
  >
    <div style="padding-bottom: 25px">
      {{ playerOption.name }}
    </div>
    <v-slider
      :model-value="playerOption.value as number"
      :min="playerOption.min_value"
      :max="playerOption.max_value"
      :step="playerOption.step"
      thumb-label="always"
      :thumb-size="20"
      show-ticks="always"
      :tick-size="4"
      :readonly="playerOption.read_only"
      @end="uiSetPlayerOption(playerOption.key, $event)"
    >
      <template #prepend>
        <v-label :text="playerOption.min_value as unknown as string" />
      </template>
      <template #append>
        <v-label :text="playerOption.max_value as unknown as string" />
      </template>
    </v-slider>
  </div>

  <!-- text field for int/ float where some of the above are missing -->
  <div
    v-else-if="
      playerOption.type === PlayerOptionType.INTEGER ||
      playerOption.type === PlayerOptionType.FLOAT
    "
  >
    <v-text-field
      :model-value="playerOption.value"
      :label="playerOption.name"
      :clearable="false"
      :min="playerOption.min_value"
      :max="playerOption.max_value"
      :step="playerOption.step"
      type="number"
      variant="outlined"
      density="comfortable"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>

  <!-- text field for string -->
  <div v-else-if="playerOption.type === PlayerOptionType.STRING">
    <v-text-field
      :model-value="playerOption.value"
      :label="playerOption.name"
      :clearable="false"
      type="string"
      variant="outlined"
      density="comfortable"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import { PlayerOption, PlayerOptionValueType } from "@/plugins/api/interfaces";
import { PlayerOptionType } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  playerOption: PlayerOption;
  playerId: string;
}>();

const uiSetPlayerOption = async (
  key: string,
  value: PlayerOptionValueType | PlayerOptionValueType[] | null | undefined,
) => {
  if (!props.playerId || value === null || value === undefined) return;
  // we only have single numbers
  if (Array.isArray(value)) value = value[0];
  try {
    await api.playerCommandSetOption(props.playerId, key, value);
  } catch (error) {
    toast.error(`Error while setting player option: ${key} ${value}`);
  }
};

// labels and option titles are localized server-side, so the resolved name is rendered directly
const selectOptions = computed(() => {
  if (!props.playerOption.options) return [];
  return props.playerOption.options.map((option) => ({
    title: option.name,
    value: option.value,
  }));
});
</script>
