<template>
  <div class="rounded-md border bg-card/40 transition-colors hover:bg-card">
    <div class="flex items-center gap-2 px-3 py-2">
      <div class="flex flex-col">
        <Button
          variant="ghost-icon"
          size="icon-xs"
          :disabled="!canMoveUp"
          :aria-label="$t('providers.ai_radio.actions.up')"
          @click="emit('move-up')"
        >
          <ChevronUp class="h-3.5 w-3.5" />
        </Button>
        <Button
          variant="ghost-icon"
          size="icon-xs"
          :disabled="!canMoveDown"
          :aria-label="$t('providers.ai_radio.actions.down')"
          @click="emit('move-down')"
        >
          <ChevronDown class="h-3.5 w-3.5" />
        </Button>
      </div>

      <Input
        v-model="name"
        class="h-8 min-w-0 flex-1"
        :aria-label="$t('providers.ai_radio.customize.segment_name')"
      />

      <Select v-model="playsKind">
        <SelectTrigger class="h-8 w-[170px] shrink-0 text-xs">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          <SelectItem
            v-for="option in playsKindOptions"
            :key="option.kind"
            :value="option.kind"
            class="text-xs"
          >
            {{ option.label }}
          </SelectItem>
        </SelectContent>
      </Select>

      <NumberField
        v-if="needsN"
        v-model="playsN"
        class="w-16 shrink-0"
        :min="1"
        :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
      >
        <NumberFieldContent>
          <NumberFieldInput class="h-8 text-xs" />
        </NumberFieldContent>
      </NumberField>
      <NumberField
        v-if="needsPercent"
        v-model="playsPercent"
        class="w-16 shrink-0"
        :min="0"
        :max="100"
        :format-options="{ useGrouping: false, maximumFractionDigits: 0 }"
      >
        <NumberFieldContent>
          <NumberFieldInput class="h-8 text-xs" />
        </NumberFieldContent>
      </NumberField>

      <Button
        variant="ghost-icon"
        size="icon-sm"
        class="shrink-0"
        :aria-label="$t('open')"
        @click="expanded = !expanded"
      >
        <ChevronDown
          class="h-4 w-4 transition-transform"
          :class="{ 'rotate-180': expanded }"
        />
      </Button>
    </div>

    <div v-if="expanded" class="space-y-3 border-t px-3 py-3">
      <div class="flex flex-col gap-1.5">
        <Label>{{ $t("providers.ai_radio.fields.prompt") }}</Label>
        <Textarea v-model="prompt" rows="4" class="text-sm" />
        <p class="text-xs text-muted-foreground">
          {{ $t("providers.ai_radio.customize.prompt_placeholders_hint") }}
        </p>
      </div>

      <div class="grid gap-3 sm:grid-cols-2">
        <div class="flex flex-col gap-1.5">
          <Label>{{ $t("providers.ai_radio.fields.web_search_mode") }}</Label>
          <Select v-model="webSearch">
            <SelectTrigger class="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="disabled">
                {{ $t("providers.ai_radio.web_search.disabled") }}
              </SelectItem>
              <SelectItem value="allow">
                {{ $t("providers.ai_radio.web_search.allow") }}
              </SelectItem>
              <SelectItem value="force">
                {{ $t("providers.ai_radio.web_search.force") }}
              </SelectItem>
            </SelectContent>
          </Select>
          <p class="text-xs text-muted-foreground">
            {{ $t("providers.ai_radio.web_search.help") }}
          </p>
        </div>

        <div class="flex flex-col gap-1.5">
          <Label>{{ $t("providers.ai_radio.fields.character_limit") }}</Label>
          <NumberField v-model="maxChars" :min="0" :step="50">
            <NumberFieldContent>
              <NumberFieldDecrement />
              <NumberFieldInput />
              <NumberFieldIncrement />
            </NumberFieldContent>
          </NumberField>
        </div>
      </div>

      <div class="flex justify-end">
        <Button
          variant="outline"
          size="sm"
          class="text-destructive hover:text-destructive"
          @click="emit('remove')"
        >
          <Trash2 class="h-4 w-4" />
          {{ $t("providers.ai_radio.actions.remove") }}
        </Button>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  NumberField,
  NumberFieldContent,
  NumberFieldDecrement,
  NumberFieldIncrement,
  NumberFieldInput,
} from "@/components/ui/number-field";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import {
  playsRuleLabel,
  type PlaysRule,
  type ShowSegment,
} from "@/helpers/ai_radio";
import type { AIRadioWebSearchMode } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronDown, ChevronUp, Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";

const props = defineProps<{
  segment: ShowSegment;
  canMoveUp: boolean;
  canMoveDown: boolean;
}>();

const emit = defineEmits<{
  update: [segment: ShowSegment];
  "move-up": [];
  "move-down": [];
  remove: [];
}>();

const expanded = ref(false);

const DEFAULT_EVERY_N_SONGS = 3;
const DEFAULT_EVERY_N_MIN = 60;
const DEFAULT_OCCASIONALLY_PERCENT = 20;

const PLAYS_KINDS: PlaysRule["kind"][] = [
  "start",
  "end",
  "every_song",
  "every_n_songs",
  "every_n_min",
  "occasionally",
];

/** A representative rule per kind, used to render the Select's option labels via playsRuleLabel. */
function representativeRule(kind: PlaysRule["kind"]): PlaysRule {
  if (props.segment.plays.kind === kind) return props.segment.plays;
  switch (kind) {
    case "every_n_songs":
      return { kind, n: DEFAULT_EVERY_N_SONGS };
    case "every_n_min":
      return { kind, n: DEFAULT_EVERY_N_MIN };
    case "occasionally":
      return { kind, percent: DEFAULT_OCCASIONALLY_PERCENT };
    default:
      return { kind };
  }
}

const playsKindOptions = computed(() =>
  PLAYS_KINDS.map((kind) => ({
    kind,
    label: playsRuleLabel(representativeRule(kind)),
  })),
);

const needsN = computed(
  () =>
    props.segment.plays.kind === "every_n_songs" ||
    props.segment.plays.kind === "every_n_min",
);
const needsPercent = computed(
  () => props.segment.plays.kind === "occasionally",
);

const name = computed({
  get: () => props.segment.name,
  set: (value: string) => emit("update", { ...props.segment, name: value }),
});

const prompt = computed({
  get: () => props.segment.prompt,
  set: (value: string) => emit("update", { ...props.segment, prompt: value }),
});

const webSearch = computed({
  get: () => props.segment.webSearch,
  set: (value: AIRadioWebSearchMode) =>
    emit("update", { ...props.segment, webSearch: value }),
});

const maxChars = computed({
  get: () => props.segment.maxChars,
  set: (value: number) =>
    emit("update", { ...props.segment, maxChars: Math.max(0, value) }),
});

const playsKind = computed({
  get: () => props.segment.plays.kind,
  set: (kind: PlaysRule["kind"]) => {
    emit("update", { ...props.segment, plays: representativeRule(kind) });
  },
});

const playsN = computed({
  get: () => {
    const { plays } = props.segment;
    return plays.kind === "every_n_songs" || plays.kind === "every_n_min"
      ? plays.n
      : 0;
  },
  set: (value: number) => {
    const { plays } = props.segment;
    if (plays.kind !== "every_n_songs" && plays.kind !== "every_n_min") return;
    emit("update", {
      ...props.segment,
      plays: { kind: plays.kind, n: Math.max(1, value) },
    });
  },
});

const playsPercent = computed({
  get: () => {
    const { plays } = props.segment;
    return plays.kind === "occasionally" ? plays.percent : 0;
  },
  set: (value: number) => {
    if (props.segment.plays.kind !== "occasionally") return;
    emit("update", {
      ...props.segment,
      plays: {
        kind: "occasionally",
        percent: Math.min(100, Math.max(0, value)),
      },
    });
  },
});
</script>
