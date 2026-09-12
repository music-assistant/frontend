<script setup lang="ts">
import type { CollapsibleTriggerProps } from "reka-ui";
import { CollapsibleTrigger } from "reka-ui";

defineProps<CollapsibleTriggerProps>();
</script>

<template>
  <CollapsibleTrigger data-slot="collapsible-trigger" v-bind="$props">
    <slot></slot>
  </CollapsibleTrigger>
</template>
