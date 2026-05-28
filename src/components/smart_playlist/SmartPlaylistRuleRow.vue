<template>
  <div
    :class="[
      'group flex items-center gap-2 rounded-md border bg-card/40 px-2 py-1.5 hover:bg-card transition-colors',
      invalid ? 'border-destructive ring-1 ring-destructive/40' : '',
    ]"
  >
    <Select
      :model-value="rule.field"
      @update:model-value="(v) => emit('change-field', v as RuleField)"
    >
      <SelectTrigger
        class="h-7 w-[110px] text-xs font-medium border-0 bg-transparent shadow-none hover:bg-accent px-2"
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
      v-if="rule.field !== 'favorite'"
      :model-value="rule.operator"
      :disabled="rule.field === 'year'"
      @update:model-value="(v) => emit('change-operator', v as RuleOperator)"
    >
      <SelectTrigger
        :class="[
          'h-7 w-[90px] text-xs border-0 bg-transparent shadow-none px-2',
          rule.field === 'year'
            ? 'opacity-70 cursor-default'
            : 'hover:bg-accent',
        ]"
      >
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="is" class="text-xs">
          {{
            rule.field === "year"
              ? $t("smart_playlist.op_between")
              : $t("smart_playlist.op_is")
          }}
        </SelectItem>
        <SelectItem v-if="rule.field !== 'year'" value="is_not" class="text-xs">
          {{ $t("smart_playlist.op_is_not") }}
        </SelectItem>
      </SelectContent>
    </Select>

    <div class="flex-1 min-w-0 flex items-center gap-1 flex-wrap">
      <span
        v-if="rule.field === 'favorite'"
        class="text-xs text-muted-foreground px-1"
      >
        {{ $t("smart_playlist.favorites_yes") }}
      </span>

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

      <template v-else>
        <Badge
          v-for="v in rule.values"
          :key="v.id"
          variant="default"
          class="gap-1 max-w-[200px] pr-1"
        >
          <span class="truncate text-xs">{{ v.name }}</span>
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
          :preloaded-options="rule.field === 'genre' ? genreOptions : []"
          :add-label="pickerAddLabel"
          @add="(opt) => emit('add-value', opt)"
        />
      </template>
    </div>

    <Button
      variant="ghost"
      size="icon"
      class="h-7 w-7 flex-shrink-0 text-muted-foreground hover:text-destructive"
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
import { $t } from "@/plugins/i18n";
import { X } from "lucide-vue-next";
import { computed } from "vue";
import SmartPlaylistRuleValuePicker from "./SmartPlaylistRuleValuePicker.vue";

const props = defineProps<{
  rule: RuleRow;
  availableFields: RuleField[];
  genreOptions: { id: number; name: string }[];
  invalid?: boolean;
}>();

const emit = defineEmits<{
  "change-field": [field: RuleField];
  "change-operator": [op: RuleOperator];
  "change-year": [value: { from?: number; to?: number }];
  "add-value": [value: { id: number; name: string }];
  "remove-value": [id: number];
  remove: [];
}>();

const fieldOptions = computed(() => {
  const all: { value: RuleField; label: string }[] = [
    { value: "genre", label: $t("genre") },
    { value: "artist", label: $t("artist") },
    { value: "album", label: $t("album") },
    { value: "favorite", label: $t("smart_playlist.field_favorite") },
    { value: "year", label: $t("smart_playlist.field_year") },
  ];
  return all.filter(
    (o) =>
      o.value === props.rule.field || props.availableFields.includes(o.value),
  );
});

const pickerSource = computed(
  () => props.rule.field as "genre" | "artist" | "album",
);

const pickerAddLabel = computed(() => {
  switch (props.rule.field) {
    case "genre":
      return $t("genre");
    case "artist":
      return $t("artist");
    case "album":
      return $t("album");
    default:
      return $t("add");
  }
});
</script>
