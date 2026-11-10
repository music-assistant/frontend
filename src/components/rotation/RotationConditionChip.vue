<template>
  <Popover v-model:open="open">
    <PopoverTrigger as-child>
      <Button
        variant="ghost"
        size="sm"
        :class="cn(CHIP_CLASS, 'h-7 font-normal', error && CHIP_INVALID_CLASS)"
        :title="title"
        :aria-invalid="error ? 'true' : undefined"
      >
        <span class="min-w-0 truncate">{{ chipText }}</span>
      </Button>
    </PopoverTrigger>
    <PopoverContent
      align="start"
      class="flex w-auto max-w-[min(420px,calc(100vw-2rem))] flex-col gap-3"
    >
      <div class="flex flex-wrap items-center gap-2">
        <Select
          :model-value="condition.field"
          @update:model-value="onField(String($event))"
        >
          <SelectTrigger size="sm" :aria-label="$t('rotation.value.field')">
            <span>{{ fieldInfo?.label ?? condition.field }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="f in fields" :key="f.name" :value="f.name">
              {{ f.label }}
            </SelectItem>
          </SelectContent>
        </Select>
        <Select
          v-if="fieldInfo"
          :model-value="condition.op"
          @update:model-value="onOperator(String($event))"
        >
          <SelectTrigger size="sm" :aria-label="$t('rotation.value.operator')">
            <span>{{ operatorLabel(condition.op) }}</span>
          </SelectTrigger>
          <SelectContent>
            <SelectItem v-for="op in fieldInfo.operators" :key="op" :value="op">
              {{ operatorLabel(op) }}
            </SelectItem>
          </SelectContent>
        </Select>
      </div>
      <RotationValueInput
        v-if="fieldInfo"
        :key="`${fieldInfo.name}-${condition.op}`"
        :field="fieldInfo"
        :op="condition.op"
        :model-value="condition.value"
        :providers="providers"
        @update:model-value="emit('update', { ...condition, value: $event })"
      />
      <Button
        v-if="removable"
        variant="ghost"
        size="sm"
        class="w-fit text-destructive"
        @click="onRemove"
      >
        <Trash2 class="h-3.5 w-3.5" />
        {{ $t("rotation.value.remove") }}
      </Button>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import RotationValueInput from "@/components/rotation/RotationValueInput.vue";
import {
  CHIP_CLASS,
  CHIP_INVALID_CLASS,
} from "@/components/rotation/constants";
import { Button } from "@/components/ui/button";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import { useRotationRefLabels } from "@/composables/rotation/useRotationRefLabels";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import { formatList } from "@/helpers/list_format";
import {
  BETWEEN_OPERATOR,
  IN_LAST_DAYS_OPERATOR,
  isRefTextOperator,
  newCondition,
  withOperator,
} from "@/helpers/rotation_conditions";
import { cn } from "@/lib/utils";
import type {
  RotationCondition,
  RotationDescribe,
  RotationFieldInfo,
} from "@/plugins/api/interfaces";
import { $t, i18n } from "@/plugins/i18n";
import { Trash2 } from "@lucide/vue";
import { computed, ref } from "vue";

// picks the plural form of a message when the count itself is missing
const PLURAL_COUNT = 2;

const props = defineProps<{
  condition: RotationCondition;
  fields: RotationFieldInfo[];
  providers?: RotationDescribe["providers"];
  removable?: boolean;
  // why the condition does not work here; marks the chip invalid
  error?: string;
}>();

const emit = defineEmits<{
  update: [condition: RotationCondition];
  remove: [];
}>();

const open = ref(false);
const locale = useCanonicalLocale();

const fieldInfo = computed(() =>
  props.fields.find((f) => f.name === props.condition.field),
);

// a reference field matched by name holds typed text, not item references
const isRefLookup = computed(
  () =>
    fieldInfo.value?.type === "ref" &&
    !isRefTextOperator(fieldInfo.value.type, props.condition.op),
);

const refValues = computed(() => {
  if (!isRefLookup.value) return [];
  const value = props.condition.value;
  const list = Array.isArray(value) ? value : [value];
  return list.filter((v): v is string => typeof v === "string" && v !== "");
});
const { labelOf } = useRotationRefLabels(
  () => props.condition.field,
  () => refValues.value,
  () => props.providers ?? [],
);

// a date is before or after another one, not less or more
const DATE_WORDED = ["less_than", "more_than"];

function wordedOp(op: string): string {
  return fieldInfo.value?.type === "date" && DATE_WORDED.includes(op)
    ? `date_${op}`
    : op;
}

function operatorLabel(op: string): string {
  return $t(`rotation.operator.${wordedOp(op)}`);
}

function plain(value: unknown): string {
  if (value === undefined || value === null || value === "") {
    return $t("rotation.value.empty");
  }
  return String(value);
}

function anyOf(values: string[]): string {
  return values.length > 0
    ? formatList(values, locale.value, "disjunction")
    : $t("rotation.value.empty");
}

const valueText = computed(() => {
  const value = props.condition.value;
  const type = fieldInfo.value?.type;
  if (isRefLookup.value) return anyOf(refValues.value.map(labelOf));
  if (type === "bool") {
    return value === false ? $t("rotation.value.no") : $t("rotation.value.yes");
  }
  if (Array.isArray(value)) return anyOf(value.map(plain));
  return plain(value);
});

const chipText = computed(() => {
  const { op, value } = props.condition;
  const field = fieldInfo.value?.label ?? props.condition.field;
  if (op === BETWEEN_OPERATOR && Array.isArray(value)) {
    return $t("rotation.condition.between", {
      field,
      from: plain(value[0]),
      to: plain(value[1]),
    });
  }
  if (op === IN_LAST_DAYS_OPERATOR) {
    const count = typeof value === "number" ? value : PLURAL_COUNT;
    return $t(
      "rotation.condition.in_last_days",
      { field, days: plain(value) },
      count,
    );
  }
  const key = `rotation.condition.${wordedOp(op)}`;
  return i18n.global.te(key, "en")
    ? $t(key, { field, value: valueText.value })
    : $t("rotation.condition.other", {
        field,
        operator: operatorLabel(op),
        value: valueText.value,
      });
});

const title = computed(() =>
  props.error ? `${chipText.value}\n${props.error}` : chipText.value,
);

function onField(name: string) {
  const next = props.fields.find((f) => f.name === name);
  if (next) emit("update", newCondition(next));
}

function onOperator(op: string) {
  if (fieldInfo.value) {
    emit("update", withOperator(props.condition, fieldInfo.value, op));
  }
}

function onRemove() {
  open.value = false;
  emit("remove");
}
</script>
