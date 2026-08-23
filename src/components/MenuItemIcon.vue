<script setup lang="ts">
import type { Component } from "vue";
import { VIcon } from "vuetify/components";

const props = withDefaults(
  defineProps<{ icon?: string | Component; size?: number }>(),
  { icon: undefined, size: 20 },
);
</script>

<template>
  <VIcon
    v-if="typeof props.icon === 'string'"
    :icon="props.icon"
    :size="props.size"
    class="shrink-0"
  />
  <component
    :is="props.icon"
    v-else-if="props.icon"
    class="size-5 shrink-0 scale-90"
  />
</template>
