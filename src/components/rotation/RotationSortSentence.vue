<template>
  <template v-for="(key, i) in step.keys" :key="i">
    <i18n-t :keypath="keyPath(i, key.field)" scope="global">
      <template #field>
        <RotationChipSelect
          :model-value="key.field"
          :options="fieldOptions"
          :label="$t('rotation.step.chip.sort_field')"
          :error="errorTextAt(errors, `keys[${i}].field`)"
          @update:model-value="(field) => onField(i, field)"
        />
      </template>
      <template #direction>
        <RotationChipSelect
          :model-value="key.descending ? 'desc' : 'asc'"
          :options="directionOptions"
          :label="$t('rotation.step.chip.sort_direction')"
          :error="errorTextAt(errors, `keys[${i}].descending`)"
          @update:model-value="(dir) => onDirection(i, dir)"
        />
      </template>
    </i18n-t>
    <Button
      v-if="step.keys.length > 1"
      variant="ghost"
      size="icon"
      class="h-6 w-6"
      :aria-label="$t('rotation.step.remove_sort_key')"
      @click="onRemove(i)"
    >
      <X class="h-3 w-3" />
    </Button>
  </template>
  <Button
    variant="ghost"
    size="icon"
    class="h-7 w-7 text-muted-foreground"
    :disabled="!nextField"
    :aria-label="$t('rotation.step.add_sort_key')"
    @click="onAdd"
  >
    <Plus class="h-3.5 w-3.5" />
  </Button>
</template>

<script setup lang="ts">
import RotationChipSelect from "@/components/rotation/RotationChipSelect.vue";
import { Button } from "@/components/ui/button";
import { RANDOM_FIELD } from "@/helpers/rotation_conditions";
import { errorTextAt } from "@/helpers/rotation_errors";
import type { RotationStep, RotationStepError } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Plus, X } from "@lucide/vue";
import { computed } from "vue";

type SortStep = Extract<RotationStep, { type: "sort" }>;

const props = defineProps<{
  step: SortStep;
  sortFields: { name: string; label: string | null }[];
  // the validation errors of this step
  errors?: RotationStepError[];
}>();

const emit = defineEmits<{
  update: [step: RotationStep];
}>();

const fieldOptions = computed(() =>
  props.sortFields.map((f) => ({
    value: f.name,
    label:
      f.name === RANDOM_FIELD
        ? $t("rotation.step.randomly")
        : (f.label ?? f.name),
  })),
);
const directionOptions = computed(() => [
  { value: "asc", label: $t("rotation.step.ascending") },
  { value: "desc", label: $t("rotation.step.descending") },
]);

const nextField = computed(() =>
  props.sortFields.find(
    (f) =>
      f.name !== RANDOM_FIELD &&
      !props.step.keys.some((k) => k.field === f.name),
  ),
);

function keyPath(index: number, field: string): string {
  const random = field === RANDOM_FIELD;
  if (index === 0) {
    return random ? "rotation.step.sort_random" : "rotation.step.sort";
  }
  return random ? "rotation.step.sort_then_random" : "rotation.step.sort_then";
}

function onField(index: number, field: string) {
  emit("update", {
    ...props.step,
    keys: props.step.keys.map((k, i) =>
      i === index ? { field, descending: k.descending } : k,
    ),
  });
}

function onDirection(index: number, direction: string) {
  emit("update", {
    ...props.step,
    keys: props.step.keys.map((k, i) =>
      i === index ? { ...k, descending: direction === "desc" } : k,
    ),
  });
}

function onRemove(index: number) {
  emit("update", {
    ...props.step,
    keys: props.step.keys.filter((_, i) => i !== index),
  });
}

function onAdd() {
  if (!nextField.value) return;
  emit("update", {
    ...props.step,
    keys: [...props.step.keys, { field: nextField.value.name }],
  });
}
</script>
