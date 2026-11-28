<template>
  <Field orientation="horizontal">
    <FieldContent>
      <FieldLabel :for="id" class="font-normal">
        {{ $t("auth.allow_explicit") }}
      </FieldLabel>
      <FieldDescription>
        {{ $t("auth.allow_explicit_hint") }}
      </FieldDescription>
    </FieldContent>
    <Switch
      :id="id"
      :model-value="modelValue"
      @update:model-value="(value: boolean) => emit('update:modelValue', value)"
    />
  </Field>
</template>

<script setup lang="ts">
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldLabel,
} from "@/components/ui/field";
import { Switch } from "@/components/ui/switch";

defineProps<{
  modelValue: boolean;
  id: string;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: boolean];
}>();
</script>
