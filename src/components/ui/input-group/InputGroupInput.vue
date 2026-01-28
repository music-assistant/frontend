<script setup lang="ts">
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { HTMLAttributes } from "vue";
import { ref, useAttrs } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  class?: HTMLAttributes["class"];
}>();

const attrs = useAttrs();

const inputRef = ref<InstanceType<typeof Input> | null>(null);

const focus = () => {
  inputRef.value?.focus();
};

defineExpose({
  focus,
});
</script>

<template>
  <Input
    ref="inputRef"
    v-bind="attrs"
    data-slot="input-group-control"
    :class="
      cn(
        'flex-1 rounded-none border-0 bg-transparent shadow-none focus-visible:ring-0 dark:bg-transparent',
        props.class,
      )
    "
  />
</template>
