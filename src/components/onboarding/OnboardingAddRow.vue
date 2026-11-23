<template>
  <!-- the last row of a list that can take another one -->
  <Item
    as="button"
    type="button"
    size="sm"
    class="text-primary hover:bg-accent/50 w-full cursor-pointer text-left transition-colors"
  >
    <ItemMedia class="size-8 place-items-center">
      <component :is="icon ?? Plus" class="size-5" aria-hidden="true" />
    </ItemMedia>
    <ItemContent>
      <ItemTitle>{{ label }}</ItemTitle>
    </ItemContent>
  </Item>
</template>

<script setup lang="ts">
import { Item, ItemContent, ItemMedia, ItemTitle } from "@/components/ui/item";
import { Plus } from "@lucide/vue";
import type { Component } from "vue";

defineProps<{
  label: string;
  icon?: Component;
}>();
</script>
