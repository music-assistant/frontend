<template>
  <div
    :class="[
      'group flex min-w-0 flex-col gap-2 overflow-hidden rounded-md border bg-card/40 px-2 py-1.5 transition-colors hover:bg-card sm:flex-row sm:items-center',
      invalid ? 'border-destructive ring-1 ring-destructive/40' : '',
    ]"
  >
    <div class="flex min-w-0 items-center gap-2">
      <component
        :is="fieldIcon(rule.field)"
        class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
      />
      <Select
        :model-value="rule.field"
        @update:model-value="(v) => emit('change-field', v as RuleField)"
      >
        <SelectTrigger
          class="h-7 w-[110px] shrink-0 text-xs font-medium border-0 bg-transparent px-2 shadow-none hover:bg-accent"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="opt in fieldOptions"
            :key="opt.value"
            :value="opt.value"
            class="text-xs"
          >
            {{ opt.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Select
        v-if="
          rule.field !== 'favorite' &&
          rule.field !== 'explicit' &&
          rule.field !== 'last_played'
        "
        :key="`operator-${rule.field}`"
        :model-value="rule.operator"
        :disabled="rule.field === 'year' || rule.field === 'duration'"
        @update:model-value="(v) => emit('change-operator', v as RuleOperator)"
      >
        <SelectTrigger
          :class="[
            'h-7 w-[110px] shrink-0 text-xs border-0 bg-transparent px-2 shadow-none',
            rule.field === 'year' || rule.field === 'duration'
              ? 'cursor-default opacity-70'
              : 'hover:bg-accent',
          ]"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="is" class="text-xs">
            {{
              rule.field === "year" || rule.field === "duration"
                ? $t("smart_playlist.op_between")
                : $t("smart_playlist.op_is")
            }}
          </SelectItem>
          <SelectItem
            v-if="rule.field !== 'year' && rule.field !== 'duration'"
            value="is_not"
            class="text-xs"
          >
            {{ $t("smart_playlist.op_is_not") }}
          </SelectItem>
        </SelectContent>
      </Select>

      <Button
        variant="ghost"
        size="icon"
        class="ml-auto h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive sm:hidden"
        :aria-label="$t('tooltip.remove_rule')"
        @click="emit('remove')"
      >
        <X class="h-3.5 w-3.5" />
      </Button>
    </div>

    <div class="flex min-w-0 flex-1 flex-wrap items-center gap-1 sm:min-w-0">
      <span
        v-if="rule.field === 'favorite'"
        class="text-xs text-muted-foreground px-1"
      >
        {{ $t("smart_playlist.favorites_yes") }}
      </span>

      <Select
        v-else-if="rule.field === 'explicit'"
        :model-value="rule.operator"
        @update:model-value="(v) => emit('change-operator', v as RuleOperator)"
      >
        <SelectTrigger
          class="h-7 w-[130px] shrink-0 text-xs border-0 bg-transparent px-2 shadow-none hover:bg-accent"
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="allowed" class="text-xs">
            {{ $t("smart_playlist.explicit_allowed") }}
          </SelectItem>
          <SelectItem value="is" class="text-xs">
            {{ $t("smart_playlist.explicit_only") }}
          </SelectItem>
          <SelectItem value="is_not" class="text-xs">
            {{ $t("smart_playlist.explicit_not_allowed") }}
          </SelectItem>
        </SelectContent>
      </Select>

      <template v-else-if="rule.field === 'year'">
        <NumberField
          :model-value="rule.yearFrom"
          class="w-[80px]"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          @update:model-value="
            (v) => emit('change-year', { from: v, to: rule.yearTo })
          "
          @keydown.stop
        >
          <NumberFieldContent>
            <NumberFieldInput
              class="h-7 text-xs"
              :placeholder="$t('smart_playlist.year_from')"
            />
          </NumberFieldContent>
        </NumberField>
        <span class="text-xs text-muted-foreground">–</span>
        <NumberField
          :model-value="rule.yearTo"
          class="w-[80px]"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          @update:model-value="
            (v) => emit('change-year', { from: rule.yearFrom, to: v })
          "
          @keydown.stop
        >
          <NumberFieldContent>
            <NumberFieldInput
              class="h-7 text-xs"
              :placeholder="$t('smart_playlist.year_to')"
            />
          </NumberFieldContent>
        </NumberField>
      </template>

      <template v-else-if="rule.field === 'duration'">
        <input
          type="text"
          :value="secondsToMMSS(rule.minDuration)"
          placeholder="MM:SS"
          class="h-7 w-[65px] rounded-md border border-input bg-transparent px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @input="(e) => handleDurationInput(e, 'min')"
          @blur="(e) => handleDurationBlur(e, 'min')"
        />
        <span class="text-xs text-muted-foreground">–</span>
        <input
          type="text"
          :value="secondsToMMSS(rule.maxDuration)"
          placeholder="MM:SS"
          class="h-7 w-[65px] rounded-md border border-input bg-transparent px-2 text-xs transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
          @input="(e) => handleDurationInput(e, 'max')"
          @blur="(e) => handleDurationBlur(e, 'max')"
        />
      </template>

      <template v-else-if="rule.field === 'last_played'">
        <NumberField
          :model-value="rule.lastPlayedBeforeValue"
          class="w-[70px]"
          :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
          @update:model-value="(v) => handleLastPlayedValueChange(v)"
          @keydown.stop
        >
          <NumberFieldContent>
            <NumberFieldInput class="h-7 text-xs" placeholder="0" />
          </NumberFieldContent>
        </NumberField>
        <Select
          :model-value="rule.lastPlayedBeforeUnit || 'days'"
          @update:model-value="(v) => handleLastPlayedUnitChange(v)"
        >
          <SelectTrigger class="h-7 w-[90px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="hours" class="text-xs">{{
              $t("smart_playlist.unit_hours")
            }}</SelectItem>
            <SelectItem value="days" class="text-xs">{{
              $t("smart_playlist.unit_days")
            }}</SelectItem>
            <SelectItem value="weeks" class="text-xs">{{
              $t("smart_playlist.unit_weeks")
            }}</SelectItem>
            <SelectItem value="months" class="text-xs">{{
              $t("smart_playlist.unit_months")
            }}</SelectItem>
          </SelectContent>
        </Select>
        <span class="text-xs text-muted-foreground">{{
          $t("smart_playlist.last_played_ago")
        }}</span>
      </template>

      <template v-else>
        <Badge
          v-for="v in rule.values"
          :key="v.id"
          variant="default"
          class="max-w-full min-w-0 gap-1 pr-1 sm:max-w-[200px]"
        >
          <span class="min-w-0 truncate text-xs">{{ v.name }}</span>
          <button
            type="button"
            class="hover:bg-primary-foreground/20 rounded-full p-0.5 pt-1 flex-shrink-0 transition-colors"
            @click.stop="emit('remove-value', v.id)"
          >
            <X class="h-2.5 w-2.5" />
          </button>
        </Badge>

        <SmartPlaylistRuleValuePicker
          :source="pickerSource"
          :selected-ids="rule.values.map((v) => v.id)"
          :preloaded-options="
            rule.field === 'genre'
              ? genreOptions
              : rule.field === 'album_type'
                ? albumTypeOptions
                : []
          "
          :add-label="pickerAddLabel"
          @add="(opt) => emit('add-value', opt)"
        />
      </template>
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="hidden h-7 w-7 shrink-0 text-muted-foreground hover:text-destructive sm:flex"
      :aria-label="$t('tooltip.remove_rule')"
      @click="emit('remove')"
    >
      <X class="h-3.5 w-3.5" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type {
  RuleField,
  RuleOperator,
  RuleRow,
} from "@/composables/useSmartPlaylistRulesForm";
import type { Genre } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { computed } from "vue";
import { fieldIcon } from "./fieldIcon";
import SmartPlaylistRuleValuePicker from "./SmartPlaylistRuleValuePicker.vue";

const props = defineProps<{
  rule: RuleRow;
  availableFields: RuleField[];
  genreOptions: { id: number; name: string; item?: Genre }[];
  albumTypeOptions: { id: number; name: string }[];
  invalid?: boolean;
}>();

const emit = defineEmits<{
  "change-field": [field: RuleField];
  "change-operator": [op: RuleOperator];
  "change-year": [value: { from?: number; to?: number }];
  "change-duration": [value: { min?: number; max?: number }];
  "change-last-played": [value: { value?: number; unit?: string }];
  "add-value": [value: { id: number; name: string }];
  "remove-value": [id: number];
  remove: [];
}>();

const fieldOptions = computed(() => {
  const all: { value: RuleField; label: string }[] = [
    { value: "genre", label: $t("genre") },
    { value: "album_type", label: $t("album_type_label") },
    { value: "artist", label: $t("artist") },
    { value: "album", label: $t("album") },
    { value: "favorite", label: $t("smart_playlist.field_favorite") },
    { value: "explicit", label: $t("smart_playlist.field_explicit") },
    { value: "year", label: $t("smart_playlist.field_year") },
    { value: "duration", label: $t("smart_playlist.field_duration") },
    { value: "last_played", label: $t("smart_playlist.field_last_played") },
  ];
  return all.filter(
    (o) =>
      o.value === props.rule.field || props.availableFields.includes(o.value),
  );
});

const pickerSource = computed(
  () => props.rule.field as "genre" | "artist" | "album" | "album_type",
);

const pickerAddLabel = computed(() => {
  switch (props.rule.field) {
    case "genre":
      return $t("genre");
    case "album_type":
      return $t("album_type_label");
    case "artist":
      return $t("artist");
    case "album":
      return $t("album");
    default:
      return $t("add");
  }
});

// Duration MM:SS conversion helpers
function secondsToMMSS(seconds?: number): string {
  if (seconds == null || seconds === 0) return "";
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins}:${secs.toString().padStart(2, "0")}`;
}

function mmssToSeconds(mmss: string): number | undefined {
  if (!mmss || mmss.trim() === "") return undefined;
  const parts = mmss.split(":").map((p) => parseInt(p.trim(), 10));
  if (parts.length !== 2 || parts.some((p) => isNaN(p))) return undefined;
  const [mins, secs] = parts;
  if (mins < 0 || secs < 0 || secs >= 60) return undefined;
  return mins * 60 + secs;
}

const durationInputBuffer: { min?: string; max?: string } = {};

function handleDurationInput(e: Event, field: "min" | "max") {
  const input = e.target as HTMLInputElement;
  durationInputBuffer[field] = input.value;
}

function handleDurationBlur(e: Event, field: "min" | "max") {
  const input = e.target as HTMLInputElement;
  const value = input.value.trim();
  const seconds = value ? mmssToSeconds(value) : undefined;

  if (field === "min") {
    emit("change-duration", { min: seconds, max: props.rule.maxDuration });
  } else {
    emit("change-duration", { min: props.rule.minDuration, max: seconds });
  }

  delete durationInputBuffer[field];
}

function handleLastPlayedValueChange(value: number | undefined) {
  emit("change-last-played", {
    value,
    unit: props.rule.lastPlayedBeforeUnit || "days",
  });
}

function handleLastPlayedUnitChange(
  unit: string | number | bigint | boolean | object | null,
) {
  const unitStr = typeof unit === "string" ? unit : "days";
  emit("change-last-played", {
    value: props.rule.lastPlayedBeforeValue,
    unit: unitStr,
  });
}
</script>
