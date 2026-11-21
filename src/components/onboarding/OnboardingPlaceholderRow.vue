<template>
  <!-- what an empty list shows in place of its rows; a list that is still
       filling up says so with a spinner -->
  <Item size="sm" data-testid="onboarding-placeholder">
    <ItemMedia
      class="text-muted-foreground size-8 place-items-center rounded-sm border border-dashed"
    >
      <Spinner v-if="looking" class="size-4" />
      <component :is="icon" v-else class="size-4" aria-hidden="true" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle class="text-muted-foreground">{{ title }}</ItemTitle>
      <ItemDescription v-if="description">{{ description }}</ItemDescription>
    </ItemContent>
  </Item>
</template>

<script setup lang="ts">
import {
  Item,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import type { Component } from "vue";

defineProps<{
  icon: Component;
  title: string;
  description?: string;
  looking?: boolean;
}>();
</script>
