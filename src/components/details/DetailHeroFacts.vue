<template>
  <div class="flex min-w-0 items-center gap-2">
    <component :is="icon" :size="16" class="flex-none" />
    <span class="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <template v-for="(fact, index) in facts" :key="index">
        <span
          v-if="index > 0"
          class="size-[3px] flex-none rounded-full bg-current opacity-60"
          aria-hidden="true"
        ></span>
        <!-- the last fact gives way when the line runs out of room -->
        <span :class="index === facts.length - 1 ? 'min-w-0 truncate' : 'flex-none'">
          {{ fact }}
        </span>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import type { Component } from "vue";

export interface Props {
  icon: Component;
  // e.g. ["Playlist", "185 tracks", "11 h 44 min"], separated by dots
  facts: string[];
}
defineProps<Props>();
</script>
