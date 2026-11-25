<template>
  <!-- one card for a step's list: its rows (each wrapped in a list item by
       the group) sit flush, divided by a line -->
  <ItemGroup
    class="bg-card overflow-hidden rounded-xl border [&_[data-slot=item]]:rounded-none [&_[data-slot=item]]:border-0 [&_[data-slot=item]]:py-2 [&>*:not(:last-child)]:border-b [&>*:not(:last-child)]:border-border"
    data-testid="onboarding-list"
  >
    <slot />
  </ItemGroup>
</template>

<script setup lang="ts">
import { ItemGroup } from "@/components/ui/item";
</script>
