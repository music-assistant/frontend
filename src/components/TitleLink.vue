<template>
  <RouterLink
    v-if="to"
    :to="to"
    class="group inline-flex max-w-full items-center gap-0.5 text-inherit no-underline rounded-sm focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
  >
    <span class="min-w-0 overflow-hidden text-ellipsis">
      <slot>{{ title }}</slot>
    </span>
    <ChevronRight
      class="size-5 shrink-0 opacity-45 transition group-hover:translate-x-0.5 group-hover:opacity-100 group-focus-visible:translate-x-0.5 group-focus-visible:opacity-100"
    />
  </RouterLink>
  <template v-else>
    <slot>{{ title }}</slot>
  </template>
</template>

<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";
import type { RouteLocationRaw } from "vue-router";

// A section title that may lead to the listing behind it: wrapped in a link
// with a chevron when there is somewhere to go, plain text otherwise.
const props = defineProps<{
  title?: string;
  to?: RouteLocationRaw;
}>();
</script>
