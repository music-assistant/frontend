<template>
  <div class="flex min-w-0 items-center gap-2">
    <component :is="icon" :size="16" class="flex-none" aria-hidden="true" />
    <span class="flex min-w-0 items-center gap-2 whitespace-nowrap">
      <!-- a first fact that is more than text, such as a link; it gives way
           first, as it is the longest -->
      <span v-if="$slots.lead" class="min-w-0 truncate">
        <slot name="lead" />
      </span>
      <template v-for="(fact, index) in facts" :key="index">
        <span
          v-if="index > 0 || $slots.lead"
          class="size-[3px] flex-none rounded-full bg-current opacity-60"
          aria-hidden="true"
        ></span>
        <!-- the last fact gives way when the line runs out of room, unless a
             lead does -->
        <span
          :class="
            !$slots.lead && index === facts.length - 1
              ? 'min-w-0 truncate'
              : 'flex-none'
          "
        >
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
