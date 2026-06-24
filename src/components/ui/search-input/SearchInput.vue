<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search as SearchIcon, X } from "lucide-vue-next";
import { cn } from "@/lib/utils";
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
      :value="props.modelValue"
      :placeholder="props.placeholder"
      @input="
        emit('update:modelValue', ($event.target as HTMLInputElement).value)
      "
      @focus="emit('focus')"
      @blur="emit('blur')"
    />
    <InputGroupButton
      v-if="props.clearable"
      v-show="props.modelValue"
      @click="
        emit('update:modelValue', '');
        emit('clear');
      "
    >
      <X class="size-4" />
    </InputGroupButton>
  </InputGroup>
</template>
