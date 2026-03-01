<template>
  <!-- drop down for multiple options -->
  <div v-if="playerOption.options && playerOption.options.length > 0">
    <v-select
      :model-value="playerOption.value"
      :items="translatedOptions"
      :label="getTranslatedLabel()"
      variant="outlined"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>

  <!-- toggle for boolean values -->
  <div v-else-if="playerOption.type === PlayerOptionType.BOOLEAN">
    <v-switch
      :label="getTranslatedLabel()"
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
      {{ getTranslatedLabel() }}
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
      :label="getTranslatedLabel()"
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
      :label="getTranslatedLabel()"
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
import { $t } from "@/plugins/i18n";
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

// Taken from ConfigEntryField
const getTranslatedLabel = () => {
  // prefer translation_key over key (using key for translations is deprecated)
  const key = props.playerOption.translation_key || props.playerOption.key;
  const translationKey = `player_options.${key}`;
  const fallback = props.playerOption.name;

  // If translation_params are provided, pass them directly
  if (
    props.playerOption.translation_params &&
    props.playerOption.translation_params.length > 0
  ) {
    return (
      $t(translationKey, props.playerOption.translation_params) || fallback
    );
  }

  return $t(translationKey, fallback);
};

const translatedOptions = computed(() => {
  // it needs to have title and value for the dropdown
  interface translatedOption {
    title: string;
    value: PlayerOptionValueType;
  }
  if (!props.playerOption.options) return [];
  const options: translatedOption[] = [];
  for (const orgOption of props.playerOption.options) {
    let cleanKey = orgOption.key.toString() || "";
    let cleanName = orgOption.name.toString() || "";
    for (const specialChar of ["@", "$", "|"]) {
      if (cleanKey.includes(specialChar)) {
        cleanKey = cleanKey.toString().replaceAll(specialChar, "");
      }
      if (cleanName.includes(specialChar)) {
        cleanName = cleanName.toString().replaceAll(specialChar, "");
      }
    }
    let optName = $t(
      `player_options.${props.playerOption.key}.options.${cleanKey}`,
      cleanName,
    );
    const option = {
      // key and value are the same, should models change?
      title: optName,
      value: orgOption.value,
    };
    options.push(option);
  }
  return options;
});
</script>
