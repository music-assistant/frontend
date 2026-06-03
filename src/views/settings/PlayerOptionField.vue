<template>
  <!-- drop down for multiple options -->
  <div v-if="playerOption.options && playerOption.options.length > 0">
    <Field>
      <FieldLabel>{{ getTranslatedLabel() }}</FieldLabel>
      <Select
        :model-value="
          playerOption.value == null ? undefined : String(playerOption.value)
        "
        :disabled="playerOption.read_only"
        @update:model-value="
          (v) => uiSetPlayerOption(playerOption.key, rawForString(v as string))
        "
      >
        <SelectTrigger class="w-full"
          ><SelectValue :placeholder="getTranslatedLabel()"
        /></SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in selectOptions"
            :key="opt.value"
            :value="opt.value"
            >{{ opt.label }}</SelectItem
          >
        </SelectContent>
      </Select>
    </Field>
  </div>

  <!-- toggle for boolean values -->
  <div v-else-if="playerOption.type === PlayerOptionType.BOOLEAN">
    <Field orientation="horizontal">
      <Switch
        :model-value="!!playerOption.value"
        :disabled="playerOption.read_only"
        @update:model-value="(v) => uiSetPlayerOption(playerOption.key, v)"
      />
      <FieldLabel class="font-normal">{{ getTranslatedLabel() }}</FieldLabel>
    </Field>
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
    <Field>
      <FieldLabel>{{ getTranslatedLabel() }}</FieldLabel>
      <div class="flex items-center gap-3">
        <span class="text-xs text-muted-foreground">{{
          playerOption.min_value
        }}</span>
        <Slider
          class="flex-1"
          :model-value="sliderValue"
          :min="playerOption.min_value"
          :max="playerOption.max_value"
          :step="playerOption.step"
          :disabled="playerOption.read_only"
          @update:model-value="
            (v: number[] | undefined) => {
              if (v) sliderValue = v;
            }
          "
          @value-commit="
            (v: number[]) => uiSetPlayerOption(playerOption.key, v?.[0])
          "
        />
        <span class="text-xs text-muted-foreground">{{
          playerOption.max_value
        }}</span>
      </div>
    </Field>
  </div>

  <!-- text field for int/ float where some of the above are missing -->
  <div
    v-else-if="
      playerOption.type === PlayerOptionType.INTEGER ||
      playerOption.type === PlayerOptionType.FLOAT
    "
  >
    <Field>
      <FieldLabel>{{ getTranslatedLabel() }}</FieldLabel>
      <Input
        type="number"
        :model-value="playerOption.value as number"
        :min="playerOption.min_value"
        :max="playerOption.max_value"
        :step="playerOption.step"
        :readonly="playerOption.read_only"
        @update:model-value="
          (v) =>
            uiSetPlayerOption(
              playerOption.key,
              v === '' ? undefined : Number(v),
            )
        "
      />
    </Field>
  </div>

  <!-- text field for string -->
  <div v-else-if="playerOption.type === PlayerOptionType.STRING">
    <Field>
      <FieldLabel>{{ getTranslatedLabel() }}</FieldLabel>
      <Input
        :model-value="playerOption.value as string"
        :readonly="playerOption.read_only"
        @update:model-value="
          (v) => uiSetPlayerOption(playerOption.key, v as string)
        "
      />
    </Field>
  </div>
</template>

<script setup lang="ts">
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
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
import {
  PlayerOption,
  PlayerOptionType,
  PlayerOptionValueType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed, ref, watch } from "vue";
import { toast } from "vue-sonner";

const props = defineProps<{
  playerOption: PlayerOption;
  playerId: string;
}>();

// Local copy of the slider value so dragging stays smooth while we only
// persist to the backend on `value-commit` (drag end / keyboard settle).
const sliderValue = ref<number[]>([props.playerOption.value as number]);
watch(
  () => props.playerOption.value,
  (value) => {
    sliderValue.value = [value as number];
  },
);

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

const selectOptions = computed(() =>
  translatedOptions.value.map((o) => ({
    label: o.title,
    value: String(o.value),
  })),
);

const rawForString = (str: string): PlayerOptionValueType => {
  const match = props.playerOption.options?.find(
    (o) => String(o.value) === str,
  );
  return match ? match.value : str;
};
</script>
