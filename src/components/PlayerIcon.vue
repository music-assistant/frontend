<template>
  <v-icon v-if="isMdiIcon(icon)" :icon="icon ?? undefined" :size="size" v-bind="$attrs" />
  <component :is="lucideIcon || Speaker" v-else :size="size" v-bind="$attrs" />
</template>

<script setup lang="ts">
import { getLucideIcon, isMdiIcon } from "@/helpers/icon";
import { Speaker } from "@lucide/vue";
import { computed } from "vue";

const props = defineProps<{
  icon?: string | null;
  size?: number | string;
}>();

const lucideIcon = computed(() => getLucideIcon(props.icon));
</script>
