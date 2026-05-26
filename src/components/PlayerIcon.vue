<template>
  <v-icon
    v-if="grouped"
    icon="mdi-speaker-multiple"
    :size="size"
    v-bind="$attrs"
  />
  <v-icon
    v-else-if="isMdiIcon(icon)"
    :icon="icon ?? undefined"
    :size="size"
    v-bind="$attrs"
  />
  <component :is="lucideIcon || Speaker" v-else :size="size" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { getLucideIcon, isMdiIcon } from "@/helpers/icon";
import { Speaker } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  icon?: string | null;
  size?: number | string;
  grouped?: boolean;
}>();

const lucideIcon = computed(() => getLucideIcon(props.icon));
</script>
