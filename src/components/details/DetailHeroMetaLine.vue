<template>
  <div class="flex min-w-0 items-center gap-2">
    <!-- one line of facts under the hero's title: an icon and text that
         ellipsizes when it runs out of room -->
    <component :is="icon" :size="16" class="flex-none" aria-hidden="true" />
    <span class="min-w-0 truncate"><slot /></span>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";

export interface Props {
  icon: Component;
}
defineProps<Props>();
</script>
