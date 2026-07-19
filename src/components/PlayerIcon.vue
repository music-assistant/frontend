<template>
  <Speaker v-if="grouped" :size="size" v-bind="$attrs" />
  <i
    v-else-if="isMdiIcon(icon)"
    aria-hidden="true"
    class="mdi"
    :class="icon"
    :style="{ fontSize: `${size ?? 24}px`, lineHeight: 1 }"
    v-bind="$attrs"
  />
  <component :is="lucideIcon || Speaker" v-else :size="size" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { getLucideIcon, isMdiIcon } from "@/helpers/icon";
import { Speaker } from "@lucide/vue";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  icon?: string | null;
  size?: number;
  grouped?: boolean;
}>();

const lucideIcon = computed(() => getLucideIcon(props.icon));
</script>
