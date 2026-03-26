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
        <component :is="resolveIcon(icon)" class="size-5 mr-2" />
      </template>
      {{ text }}
    </Button>
  </div>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { ChevronDown } from "lucide-vue-next";
import { h } from "vue";

// properties
export interface Props {
  icon?: string;
  text?: string;
  disabled?: boolean;
  width?: number;
  loading?: boolean;
}
withDefaults(defineProps<Props>(), {
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

// Resolve MDI icon names to rendered elements
const resolveIcon = (iconName: string) => {
  if (!iconName) return h("span", { class: "size-5" });
  return h("span", { class: `mdi ${iconName} size-5` });
};
</script>
