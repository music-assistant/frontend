<template>
  <div class="flex flex-col gap-3">
    <div
      v-if="mode === 'library'"
      class="flex min-w-0 flex-wrap items-center gap-2 text-sm text-muted-foreground"
    >
      <span>{{ $t("smart_playlist.match") }}</span>
      <Select
        :model-value="logic"
        @update:model-value="(v) => emit('update:logic', v as 'AND' | 'OR')"
      >
        <SelectTrigger class="h-7 w-[90px] text-xs font-medium">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value="AND" class="text-xs">
            {{ $t("smart_playlist.match_all") }}
          </SelectItem>
          <SelectItem value="OR" class="text-xs">
            {{ $t("smart_playlist.match_any") }}
          </SelectItem>
        </SelectContent>
      </Select>
      <span>{{ $t("smart_playlist.match_following") }}</span>
    </div>
    <div
      class="flex items-start gap-2 rounded-md border border-amber-500/40 bg-amber-500/10 px-3 py-2 text-xs text-amber-900 dark:text-amber-200"
    >
      <Info class="h-3.5 w-3.5 mt-0.5 flex-shrink-0" />
      <p class="leading-relaxed">
        {{ $t("smart_playlist.seed_filters_hint") }}
      </p>
    </div>

    <div v-if="rules.length" class="flex flex-col gap-1.5">
      <SmartPlaylistRuleRow
        v-for="rule in rules"
        :key="rule.uid"
        :rule="rule"
        :available-fields="availableFields"
        :genre-options="genreOptions"
        :album-type-options="albumTypeOptions"
        :invalid="invalidRuleUids.has(rule.uid)"
        @change-field="(field) => onChangeField(rule, field)"
        @change-operator="(op) => onChangeOperator(rule, op)"
        @change-year="(v) => onChangeYear(rule, v)"
        @change-duration="(v) => onChangeDuration(rule, v)"
        @change-last-played="(v) => onChangeLastPlayed(rule, v)"
        @add-value="(v) => onAddValue(rule, v)"
        @remove-value="(id) => onRemoveValue(rule, id)"
        @remove="emit('remove-rule', rule.uid)"
      />
    </div>
    <div
      v-else
      class="rounded-md border border-dashed py-4 px-3 text-center text-xs text-muted-foreground"
    >
      {{
        mode === "seed"
          ? $t("smart_playlist.no_filters")
          : $t("smart_playlist.no_rules")
      }}
    </div>

    <div>
      <DropdownMenu>
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            size="sm"
            :disabled="availableFields.length === 0"
            class="h-8 gap-1.5 border-dashed text-xs"
          >
            <Plus class="h-3.5 w-3.5" />
            {{
              rules.length
                ? mode === "seed"
                  ? $t("smart_playlist.add_filter")
                  : $t("smart_playlist.add_rule")
                : mode === "seed"
                  ? $t("smart_playlist.add_first_filter")
                  : $t("smart_playlist.add_first_rule")
            }}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" class="w-[160px] z-[10001]">
          <DropdownMenuItem
            v-for="field in availableFields"
            :key="field"
            class="text-xs cursor-pointer gap-2"
            @click="emit('add-rule', field)"
          >
            <component
              :is="fieldIcon(field)"
              class="h-3.5 w-3.5 shrink-0 text-muted-foreground"
            />
            {{ fieldLabel(field) }}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { Info, Plus } from "@lucide/vue";
import { match } from "ts-pattern";
import { fieldIcon } from "./fieldIcon";
import SmartPlaylistRuleRow from "./SmartPlaylistRuleRow.vue";

defineProps<{
  mode: "library" | "seed";
  rules: RuleRow[];
  logic: "AND" | "OR";
  availableFields: RuleField[];
  genreOptions: { id: number; name: string; item?: Genre }[];
  albumTypeOptions: { id: number; name: string }[];
  invalidRuleUids: Set<string>;
}>();

const emit = defineEmits<{
  "update:logic": [value: "AND" | "OR"];
  "add-rule": [field: RuleField];
  "remove-rule": [uid: string];
  "update-rule": [uid: string, patch: Partial<RuleRow>];
}>();

function fieldLabel(field: RuleField): string {
  return match(field)
    .with("genre", () => $t("genre"))
    .with("album_type", () => $t("album_type_label"))
    .with("artist", () => $t("artist"))
    .with("album", () => $t("album"))
    .with("favorite", () => $t("smart_playlist.field_favorite"))
    .with("explicit", () => $t("smart_playlist.field_explicit"))
    .with("year", () => $t("smart_playlist.field_year"))
    .with("duration", () => $t("smart_playlist.field_duration"))
    .with("last_played", () => $t("smart_playlist.field_last_played"))
    .exhaustive();
}

function onChangeField(rule: RuleRow, field: RuleField) {
  emit("update-rule", rule.uid, {
    field,
    operator: "is",
    values: [],
    yearFrom: undefined,
    yearTo: undefined,
    minDuration: undefined,
    maxDuration: undefined,
    lastPlayedBeforeValue: undefined,
    lastPlayedBeforeUnit: undefined,
  });
}

function onChangeOperator(rule: RuleRow, op: RuleOperator) {
  emit("update-rule", rule.uid, { operator: op });
}

function onChangeYear(rule: RuleRow, v: { from?: number; to?: number }) {
  emit("update-rule", rule.uid, { yearFrom: v.from, yearTo: v.to });
}

function onChangeDuration(rule: RuleRow, v: { min?: number; max?: number }) {
  emit("update-rule", rule.uid, { minDuration: v.min, maxDuration: v.max });
}

function onChangeLastPlayed(
  rule: RuleRow,
  v: { value?: number; unit?: string },
) {
  emit("update-rule", rule.uid, {
    lastPlayedBeforeValue: v.value,
    lastPlayedBeforeUnit: v.unit as "hours" | "days" | "weeks" | "months",
  });
}

function onAddValue(rule: RuleRow, v: { id: number; name: string }) {
  if (rule.values.some((x) => x.id === v.id)) return;
  emit("update-rule", rule.uid, { values: [...rule.values, v] });
}

function onRemoveValue(rule: RuleRow, id: number) {
  emit("update-rule", rule.uid, {
    values: rule.values.filter((v) => v.id !== id),
  });
}
</script>
