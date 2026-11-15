<template>
  <Empty class="gap-4 border-0 py-16">
    <EmptyHeader class="max-w-md gap-3">
      <EmptyMedia class="mb-1">
        <component
          :is="icon"
          class="size-16 text-muted-foreground opacity-40"
          aria-hidden="true"
        />
      </EmptyMedia>
      <EmptyTitle class="text-muted-foreground">
        {{ $t("no_content") }}
      </EmptyTitle>
      <EmptyDescription>{{ $t("no_content_filter") }}</EmptyDescription>
    </EmptyHeader>
  </Empty>
</template>

<script setup lang="ts">
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { Component } from "vue";

interface Props {
  // the lucide icon for what the list holds
  icon: Component;
}

defineProps<Props>();
</script>
