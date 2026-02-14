<template>
  <div class="player-option-field"></div>

  <!-- read only, simply show value -->
  <div v-if="playerOption.read_only">
    <v-label>{{ getTranslatedLabel() }} </v-label>
    <v-label>{{ playerOption.value }} </v-label>
  </div>

  <!-- toggle for boolean values -->
  <div
    v-else-if="playerOption.type == PlayerOptionType.BOOLEAN"
    class="po-toggle"
  >
    <v-label>{{ getTranslatedLabel() }} </v-label>
    <v-switch
      :model-value="playerOption.value"
      @update:model-value="
        (value) => uiSetPlayerOption(playerOption.key, value)
      "
    />
  </div>

  <!-- slider for int/ float with min/max -->
  <div
    v-else-if="
      (playerOption.type == PlayerOptionType.INTEGER ||
        playerOption.type == PlayerOptionType.FLOAT) &&
      playerOption.min_value &&
      playerOption.max_value &&
      playerOption.step
    "
  >
    <v-label>{{ getTranslatedLabel() }} </v-label>
    <div>
      <v-slider
        :model-value="playerOption.value as number"
        :min="playerOption.min_value"
        :max="playerOption.max_value"
        :step="playerOption.step"
        show-ticks="always"
        @update:model-value="
          (value) => uiSetPlayerOption(playerOption.key, value)
        "
      >
        <template #append>
          <v-text-field
            v-model="playerOption.value as number"
            density="compact"
            style="width: 80px"
            type="number"
            variant="outlined"
            hide-details
          />
        </template>
      </v-slider>
    </div>
  </div>

  <!-- text field for int/ float where some of the above are missing -->
  <v-text-field
    v-else-if="
      playerOption.type == PlayerOptionType.INTEGER ||
      playerOption.type == PlayerOptionType.FLOAT
    "
    :model-value="playerOption.value"
    :label="getTranslatedLabel()"
    :clearable="false"
    :min="playerOption.min_value"
    :max="playerOption.max_value"
    :step="playerOption.step"
    type="number"
    variant="outlined"
    density="comfortable"
    @update:model-value="(value) => uiSetPlayerOption(playerOption.key, value)"
  />

  <!-- text field for string -->
  <v-text-field
    v-else-if="playerOption.type == PlayerOptionType.STRING"
    :model-value="playerOption.value"
    :label="getTranslatedLabel()"
    :clearable="false"
    type="string"
    variant="outlined"
    density="comfortable"
    @update:model-value="(value) => uiSetPlayerOption(playerOption.key, value)"
  />

  <!-- drop down for multiple options -->
  <v-select
    v-else-if="playerOption.options && playerOption.options.length > 0"
    :model-value="playerOption.value"
    :items="translatedOptions"
    :label="getTranslatedLabel()"
    variant="outlined"
    @update:model-value="(value) => uiSetPlayerOption(playerOption.key, value)"
  />
</template>

<script setup lang="ts">
import api from "@/plugins/api";
import {
  PlayerOption,
  PlayerOptionEntry,
  PlayerOptionValueType,
} from "@/plugins/api/interfaces";
import { PlayerOptionType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  playerOption: PlayerOption;
  playerId: string;
}>();

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
    console.error("Error setting option:", key, value);
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
