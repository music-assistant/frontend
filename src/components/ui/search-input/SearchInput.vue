<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { cn } from "@/lib/utils";
import { $t } from "@/plugins/i18n";
import { Search as SearchIcon } from "@lucide/vue";
import { computed, ref, useAttrs } from "vue";

defineOptions({ inheritAttrs: false });

const props = defineProps<{
  modelValue?: string;
  placeholder?: string;
  clearable?: boolean;
}>();

const emit = defineEmits<{
  "update:modelValue": [value: string];
  focus: [];
  blur: [];
  clear: [];
}>();

const attrs = useAttrs();
const rootClass = computed(() => (attrs as Record<string, unknown>).class);
const inputAttrs = computed(() => {
  const { class: _, ...rest } = attrs as Record<string, unknown>;
  return rest;
});
const inputRef = ref<InstanceType<typeof InputGroupInput> | null>(null);

defineExpose({
  focus: () => inputRef.value?.focus(),
});
</script>

<template>
  <InputGroup :class="cn('search-field', rootClass as string)">
    <InputGroupAddon>
      <SearchIcon class="size-4" />
    </InputGroupAddon>
    <InputGroupInput
      ref="inputRef"
      v-bind="inputAttrs"
      :model-value="props.modelValue"
      :placeholder="props.placeholder"
      @update:model-value="emit('update:modelValue', String($event ?? ''))"
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <InputGroupButton
      v-if="props.clearable && props.modelValue"
      type="button"
      variant="ghost-icon"
      class="text-muted-foreground hover:text-foreground"
      @click="
        emit('update:modelValue', '');
        emit('clear');
        inputRef?.focus();
      "
    >
      {{ $t("clear") }}
    </InputGroupButton>
    <!-- trailing controls rendered inside the input, e.g. an inline filter -->
    <slot name="append"></slot>
  </InputGroup>
</template>
