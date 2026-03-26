<template>
  <!-- drop down for multiple options -->
  <div v-if="playerOption.options && playerOption.options.length > 0" class="space-y-1.5">
    <Label>{{ getTranslatedLabel() }}</Label>
    <Select
      :model-value="playerOption.value != null ? String(playerOption.value) : undefined"
      :disabled="playerOption.read_only"
      @update:model-value="onSelectUpdate($event)"
    >
      <SelectTrigger class="w-full">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="opt in translatedOptions"
          :key="String(opt.value)"
          :value="String(opt.value)"
        >
          {{ opt.title }}
        </SelectItem>
      </SelectContent>
    </Select>
  </div>

  <!-- toggle for boolean values -->
  <div v-else-if="playerOption.type === PlayerOptionType.BOOLEAN" class="flex items-center gap-3">
    <Switch
      :checked="playerOption.value as boolean"
      :disabled="playerOption.read_only"
      @update:checked="uiSetPlayerOption(playerOption.key, $event)"
    />
    <Label>{{ getTranslatedLabel() }}</Label>
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
    class="space-y-2"
  >
    <Label>{{ getTranslatedLabel() }}</Label>
    <div class="flex items-center gap-3">
      <span class="text-sm text-muted-foreground shrink-0">
        {{ playerOption.min_value }}
      </span>
      <Slider
        :model-value="[playerOption.value as number]"
        :min="playerOption.min_value"
        :max="playerOption.max_value"
        :step="playerOption.step"
        :disabled="playerOption.read_only"
        class="flex-1"
        @update:model-value="uiSetPlayerOption(playerOption.key, $event[0])"
      />
      <span class="text-sm text-muted-foreground shrink-0">
        {{ playerOption.max_value }}
      </span>
    </div>
  </div>

  <!-- text field for int/ float where some of the above are missing -->
  <div
    v-else-if="
      playerOption.type === PlayerOptionType.INTEGER ||
      playerOption.type === PlayerOptionType.FLOAT
    "
    class="space-y-1.5"
  >
    <Label>{{ getTranslatedLabel() }}</Label>
    <Input
      :model-value="playerOption.value as string | number"
      :min="playerOption.min_value"
      :max="playerOption.max_value"
      :step="playerOption.step"
      type="number"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>

  <!-- text field for string -->
  <div v-else-if="playerOption.type === PlayerOptionType.STRING" class="space-y-1.5">
    <Label>{{ getTranslatedLabel() }}</Label>
    <Input
      :model-value="playerOption.value as string"
      :readonly="playerOption.read_only"
      @update:model-value="uiSetPlayerOption(playerOption.key, $event)"
    />
  </div>
</template>

<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
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

// Handle select updates - find the original value type
const onSelectUpdate = (stringValue: string) => {
  const option = props.playerOption.options?.find(
    (opt) => String(opt.value) === stringValue,
  );
  if (option) {
    uiSetPlayerOption(props.playerOption.key, option.value);
  } else {
    uiSetPlayerOption(props.playerOption.key, stringValue);
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
