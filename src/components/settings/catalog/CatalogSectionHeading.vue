<template>
  <div class="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
    <h2 class="m-0 text-lg font-semibold">{{ title }}</h2>
    <RouterLink
      v-if="linkTo && linkLabel"
      :to="linkTo"
      class="flex items-center gap-1 text-sm text-primary no-underline hover:underline"
      data-testid="catalog-manage-link"
    >
      {{ linkLabel }}
      <ChevronRight class="size-4" aria-hidden="true" />
    </RouterLink>
  </div>
</template>

<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

interface Props {
  title: string;
  // a link to where what the section lists is managed
  linkLabel?: string;
  linkTo?: RouteLocationRaw;
}

defineProps<Props>();
</script>
