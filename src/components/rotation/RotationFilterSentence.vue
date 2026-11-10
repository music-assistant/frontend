<template>
  <i18n-t
    :keypath="
      step.conditions.length > 1
        ? 'rotation.step.filter_match'
        : 'rotation.step.filter'
    "
    scope="global"
  >
    <template #mode>
      <RotationChipSelect
        :model-value="step.mode"
        :options="modeOptions"
        :label="$t('rotation.step.chip.mode')"
        :error="errorTextAt(errors, 'mode')"
        @update:model-value="onMode"
      />
    </template>
    <template #match>
      <RotationChipSelect
        :model-value="step.match"
        :options="matchOptions"
        :label="$t('rotation.step.chip.match')"
        :error="errorTextAt(errors, 'match')"
        @update:model-value="onMatch"
      />
    </template>
    <template #conditions>
      <template v-for="(condition, i) in step.conditions" :key="i">
        <span v-if="i > 0" class="text-muted-foreground">
          {{
            $t(step.match === "all" ? "rotation.step.and" : "rotation.step.or")
          }}
        </span>
        <RotationConditionChip
          :condition="condition"
          :fields="fields"
          :providers="providers"
          :error="errorTextAt(errors, `conditions[${i}]`)"
          removable
          @update="(c) => onCondition(i, c)"
          @remove="onRemove(i)"
        />
      </template>
      <Button
        variant="ghost"
        size="sm"
        class="h-7 px-2 text-muted-foreground"
        :disabled="fields.length === 0"
        :aria-label="
          step.conditions.length === 0
            ? undefined
            : $t('rotation.step.add_condition')
        "
        @click="onAdd"
      >
        <Plus class="h-3.5 w-3.5" />
        <template v-if="step.conditions.length === 0">
          {{ $t("rotation.step.pick_condition") }}
        </template>
      </Button>
    </template>
  </i18n-t>
</template>

<script setup lang="ts">
import RotationChipSelect from "@/components/rotation/RotationChipSelect.vue";
import RotationConditionChip from "@/components/rotation/RotationConditionChip.vue";
import { Button } from "@/components/ui/button";
import { newCondition } from "@/helpers/rotation_conditions";
import { errorTextAt } from "@/helpers/rotation_errors";
import type {
  RotationCondition,
  RotationDescribe,
  RotationFieldInfo,
  RotationStep,
  RotationStepError,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus } from "@lucide/vue";
import { computed } from "vue";

type FilterStep = Extract<RotationStep, { type: "filter" }>;

const props = defineProps<{
  step: FilterStep;
  fields: RotationFieldInfo[];
  providers?: RotationDescribe["providers"];
  // the validation errors of this step
  errors?: RotationStepError[];
}>();

const emit = defineEmits<{
  update: [step: RotationStep];
}>();

const modeOptions = computed(() => [
  { value: "keep", label: $t("rotation.step.keep") },
  { value: "remove", label: $t("rotation.step.remove") },
]);
const matchOptions = computed(() => [
  { value: "all", label: $t("rotation.step.match_all") },
  { value: "any", label: $t("rotation.step.match_any") },
]);

function onMode(mode: string) {
  emit("update", { ...props.step, mode: mode as FilterStep["mode"] });
}

function onMatch(match: string) {
  emit("update", { ...props.step, match: match as FilterStep["match"] });
}

function onCondition(index: number, condition: RotationCondition) {
  emit("update", {
    ...props.step,
    conditions: props.step.conditions.map((c, i) =>
      i === index ? condition : c,
    ),
  });
}

function onRemove(index: number) {
  emit("update", {
    ...props.step,
    conditions: props.step.conditions.filter((_, i) => i !== index),
  });
}

function onAdd() {
  const first = props.fields[0];
  if (!first) return;
  emit("update", {
    ...props.step,
    conditions: [...props.step.conditions, newCondition(first)],
  });
}
</script>
