<template>
  <div class="flex flex-wrap items-center gap-2">
    <RotationScalarInput
      v-if="isRefTextOperator(field.type, op)"
      type="text"
      :model-value="modelValue"
      :label="$t('rotation.value.text_placeholder')"
      @update:model-value="emit('update:modelValue', $event)"
    />

    <template v-else-if="field.type === 'ref'">
      <template v-if="op === ONE_OF_OPERATOR">
        <div
          v-for="(entry, index) in listValue"
          :key="`${index}-${entry}`"
          class="flex items-center gap-1"
        >
          <RotationRefPicker
            :field="field.name"
            :model-value="entry"
            :providers="providers"
            @update:model-value="(v) => setEntry(index, v)"
          />
          <Button
            variant="ghost"
            size="icon"
            class="h-7 w-7"
            :aria-label="$t('rotation.value.remove')"
            @click="removeEntry(index)"
          >
            <X class="h-3.5 w-3.5" />
          </Button>
        </div>
        <RotationRefPicker
          :key="listValue.length"
          :field="field.name"
          :providers="providers"
          @update:model-value="addEntry"
        />
      </template>
      <RotationRefPicker
        v-else
        :field="field.name"
        :model-value="modelValue"
        :providers="providers"
        @update:model-value="emit('update:modelValue', $event)"
      />
    </template>

    <Select
      v-else-if="field.type === 'bool'"
      :model-value="modelValue === false ? 'no' : 'yes'"
      @update:model-value="emit('update:modelValue', $event === 'yes')"
    >
      <SelectTrigger class="h-8 w-24" :aria-label="$t('rotation.value.text')">
        <span>{{
          modelValue === false
            ? $t("rotation.value.no")
            : $t("rotation.value.yes")
        }}</span>
      </SelectTrigger>
      <SelectContent>
        <SelectItem value="yes">{{ $t("rotation.value.yes") }}</SelectItem>
        <SelectItem value="no">{{ $t("rotation.value.no") }}</SelectItem>
      </SelectContent>
    </Select>

    <i18n-t
      v-else-if="op === BETWEEN_OPERATOR"
      keypath="rotation.value.between"
      scope="global"
      tag="div"
      data-testid="rotation-value-words"
      class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground [&_input]:text-foreground"
    >
      <template #from>
        <RotationScalarInput
          :type="field.type"
          :model-value="rangeValue[0]"
          :label="$t('rotation.value.from')"
          @update:model-value="(v) => setRange(0, v)"
        />
      </template>
      <template #to>
        <RotationScalarInput
          :type="field.type"
          :model-value="rangeValue[1]"
          :label="$t('rotation.value.to')"
          @update:model-value="(v) => setRange(1, v)"
        />
      </template>
    </i18n-t>

    <i18n-t
      v-else-if="op === IN_LAST_DAYS_OPERATOR"
      keypath="rotation.value.last_days"
      scope="global"
      tag="div"
      data-testid="rotation-value-words"
      class="flex flex-wrap items-center gap-2 text-sm text-muted-foreground [&_input]:text-foreground"
      :plural="dayCount"
    >
      <template #days>
        <RotationScalarInput
          type="number"
          :model-value="modelValue"
          :label="$t('rotation.value.days')"
          @update:model-value="emit('update:modelValue', $event)"
        />
      </template>
    </i18n-t>

    <RotationScalarInput
      v-else
      :type="field.type"
      :model-value="modelValue"
      :label="$t('rotation.value.text')"
      @update:model-value="emit('update:modelValue', $event)"
    />
  </div>
</template>

<script setup lang="ts">
import RotationRefPicker from "@/components/rotation/RotationRefPicker.vue";
import RotationScalarInput from "@/components/rotation/RotationScalarInput.vue";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
} from "@/components/ui/select";
import {
  BETWEEN_OPERATOR,
  IN_LAST_DAYS_OPERATOR,
  ONE_OF_OPERATOR,
  isRefTextOperator,
} from "@/helpers/rotation_conditions";
import type {
  RotationDescribe,
  RotationFieldInfo,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { X } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  field: RotationFieldInfo;
  op: string;
  modelValue?: unknown;
  providers?: RotationDescribe["providers"];
}>();

const emit = defineEmits<{
  "update:modelValue": [value: unknown];
}>();

const listValue = computed(() =>
  Array.isArray(props.modelValue) ? (props.modelValue as string[]) : [],
);
// a missing day count reads like a plural, such as "30 days"
const PLURAL_COUNT = 2;
const dayCount = computed(() =>
  typeof props.modelValue === "number" ? props.modelValue : PLURAL_COUNT,
);
const rangeValue = computed(() =>
  Array.isArray(props.modelValue)
    ? (props.modelValue as unknown[])
    : [undefined, undefined],
);

function setEntry(index: number, value: string) {
  emit(
    "update:modelValue",
    listValue.value.map((entry, i) => (i === index ? value : entry)),
  );
}

function addEntry(value: string) {
  emit("update:modelValue", [...listValue.value, value]);
}

function removeEntry(index: number) {
  emit(
    "update:modelValue",
    listValue.value.filter((_, i) => i !== index),
  );
}

function setRange(index: number, value: unknown) {
  const next = [...rangeValue.value];
  next[index] = value;
  emit("update:modelValue", next);
}
</script>
