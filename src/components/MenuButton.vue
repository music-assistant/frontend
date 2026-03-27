<template>
  <div class="relative" :style="`width: ${width}px; height: 30px;`">
    <Button
      variant="outline"
      :style="`
            width: ${width}px;
            position: absolute;
            height: 38px;
            margin-top: -1px;
            margin-left: -1px;
          `"
      :disabled="loading"
      @click="emit('menu')"
    >
      <ChevronDown class="size-5" :style="`margin-left: ${width - 42}px`" />
    </Button>

    <Button
      :disabled="disabled || loading"
      :style="`width: ${width - 40}px; justify-content: left;`"
      @click="emit('click')"
    >
      <template v-if="loading">
        <Spinner class="size-4 mr-2" />
      </template>
      <template v-else-if="icon && text!.length < 12">
        <component :is="resolvedIconComponent" class="size-5 mr-2" />
      </template>
      {{ text }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { resolveMdiIcon } from "@/helpers/iconMapping";
import { ChevronDown, HelpCircle } from "lucide-vue-next";
import { computed } from "vue";

// properties
export interface Props {
  icon?: string;
  text?: string;
  disabled?: boolean;
  width?: number;
  loading?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  icon: undefined,
  text: undefined,
  disabled: false,
  width: 200,
  loading: true,
});

// emitters
const emit = defineEmits<{
  (e: "click"): void;
  (e: "menu"): void;
}>();

const resolvedIconComponent = computed(() => {
  if (!props.icon) return undefined;
  return resolveMdiIcon(props.icon) || HelpCircle;
});
</script>
