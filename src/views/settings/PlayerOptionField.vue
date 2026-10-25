<template>
  <div
    class="flex flex-col gap-2 px-6 py-4 sm:flex-row sm:items-center sm:justify-between sm:gap-6"
  >
    <!-- the slider is named by its thumb -->
    <label
      :for="control === 'slider' ? undefined : inputId"
      class="text-sm font-medium"
    >
      {{ playerOption.name }}
    </label>

    <Switch
      v-if="control === 'switch'"
      :id="inputId"
      :model-value="playerOption.value === true"
      @update:model-value="setOption"
    />

    <Select
      v-else-if="control === 'select'"
      :model-value="selectedEntryKey"
      @update:model-value="onSelect"
    >
      <SelectTrigger :id="inputId" class="w-full shrink-0 sm:w-56">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem
          v-for="entry in playerOption.options"
          :key="entry.key"
          :value="entry.key"
        >
          {{ entry.name }}
        </SelectItem>
      </SelectContent>
    </Select>

    <div
      v-else-if="control === 'slider'"
      class="flex w-full items-center gap-3 sm:w-72"
    >
      <Slider
        :model-value="[sliderValue]"
        :min="playerOption.min_value ?? undefined"
        :max="playerOption.max_value ?? undefined"
        :step="playerOption.step ?? undefined"
        :thumb-label="playerOption.name"
        @update:model-value="onSlide"
        @value-commit="onSlideCommit"
      />
      <span class="w-12 shrink-0 text-right text-sm tabular-nums">
        {{ sliderValue }}
      </span>
    </div>

    <!-- typed values are sent once the field is left or Enter is pressed -->
    <Input
      v-else
      :id="inputId"
      v-model="draft"
      :type="control === 'number' ? 'number' : 'text'"
      :min="playerOption.min_value ?? undefined"
      :max="playerOption.max_value ?? undefined"
      :step="playerOption.step ?? 'any'"
      class="w-full shrink-0 sm:w-56"
      @change="onInputCommit"
    />
  </div>
</template>

<script setup lang="ts">
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
import {
  getPlayerOptionControl,
  parsePlayerOptionInput,
} from "@/helpers/player_options";
import api from "@/plugins/api";
import { PlayerOption, PlayerOptionValueType } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";

const props = defineProps<{
  playerOption: PlayerOption;
  playerId: string;
}>();

// local copies of the value while it is edited, reset to the server's value
// whenever that changes; v-model gives a number field's value as a number
const draft = ref<string | number>("");
const sliderValue = ref(0);

const control = computed(() => getPlayerOptionControl(props.playerOption));
const inputId = computed(() => `player-option-${props.playerOption.key}`);
// null, not undefined: reka-ui's Select stops following a model that is
// undefined when it mounts
const selectedEntryKey = computed(
  () =>
    props.playerOption.options?.find(
      (x) => x.value === props.playerOption.value,
    )?.key ?? null,
);

watch(
  () => props.playerOption.value,
  () => resetToServerValue(),
  { immediate: true },
);

function resetToServerValue() {
  draft.value = String(props.playerOption.value);
  sliderValue.value = Number(props.playerOption.value);
}

async function setOption(value: PlayerOptionValueType) {
  try {
    await api.playerCommandSetOption(
      props.playerId,
      props.playerOption.key,
      value,
    );
  } catch {
    // a failed command is already reported by the api layer
    resetToServerValue();
  }
}

function onSelect(entryKey: unknown) {
  const entry = props.playerOption.options?.find((x) => x.key === entryKey);
  if (entry) void setOption(entry.value);
}

function onSlide(value?: number[]) {
  if (value?.length) sliderValue.value = value[0];
}

function onSlideCommit(value: number[]) {
  if (value[0] !== props.playerOption.value) void setOption(value[0]);
}

function onInputCommit() {
  const value = parsePlayerOptionInput(props.playerOption, String(draft.value));
  if (value === undefined) {
    resetToServerValue();
    return;
  }
  void setOption(value);
}
</script>
