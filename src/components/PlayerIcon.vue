<template>
  <Speakers v-if="grouped" :size="size" v-bind="$attrs" />
  <component
    :is="lucideIcon || fallbackIcon"
    v-else
    :size="size"
    v-bind="$attrs"
  />
</template>

<script setup lang="ts">
import { getLucideIcon, PLAYER_ICON_FALLBACK } from "@/helpers/icon";
import { Speakers } from "@/components/ma-icons";
import { computed } from "vue";

defineOptions({
  inheritAttrs: false,
});

const props = defineProps<{
  icon?: string | null;
  size?: number;
  grouped?: boolean;
}>();

const fallbackIcon = getLucideIcon(PLAYER_ICON_FALLBACK);
const lucideIcon = computed(() => getLucideIcon(props.icon));
</script>
