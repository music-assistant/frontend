<script setup lang="ts">
import type { CollapsibleContentProps } from "reka-ui";
import { CollapsibleContent } from "reka-ui";

defineProps<CollapsibleContentProps>();
</script>

<template>
  <CollapsibleContent data-slot="collapsible-content" v-bind="$props">
    <slot></slot>
  </CollapsibleContent>
</template>
