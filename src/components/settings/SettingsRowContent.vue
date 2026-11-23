<template>
  <component :is="row.icon" class="text-primary size-5 shrink-0" />
  <div class="min-w-0 flex-1">
    <div class="text-foreground text-sm font-medium">{{ row.label }}</div>
    <!-- a problem wraps instead of being cut off, so its reason stays readable -->
    <div
      :data-testid="`${testIdPrefix}-description`"
      class="text-sm"
      :class="row.error ? 'text-destructive' : 'text-muted-foreground truncate'"
    >
      {{ row.description }}
    </div>
    <!-- a phone has no room beside the label, so the state gets a line of its own -->
    <div
      v-if="row.state"
      :data-testid="`${testIdPrefix}-state-below`"
      class="text-sm sm:hidden"
      :class="stateClass"
    >
      {{ row.state }}
    </div>
  </div>
  <span
    v-if="row.state"
    :data-testid="`${testIdPrefix}-state`"
    class="hidden max-w-[45%] truncate text-sm sm:block"
    :class="stateClass"
    :title="row.stateTitle ?? row.state"
  >
    {{ row.state }}
  </span>
</template>

<script lang="ts">
import type { Component } from "vue";

// what a settings row shows, whatever it does
export interface SettingsRowHead {
  icon: Component;
  label: string;
  description: string;
  state?: string;
  // the hover text of the state, the state itself by default
  stateTitle?: string;
  // the row reports a problem: the description gives its reason
  error?: boolean;
  // the state needs attention without being a problem
  warning?: boolean;
}
</script>

<script setup lang="ts">
import { computed } from "vue";

/**
 * The icon, label, description and state of a settings row, for the row to
 * place in its own flex line.
 */
const props = defineProps<{
  row: SettingsRowHead;
  // the start of the test ids of the parts
  testIdPrefix: string;
  // the state names what the row does, so it reads as an action
  actionState?: boolean;
}>();

const stateClass = computed(() => {
  if (props.row.error) return "text-destructive";
  if (props.row.warning) return "text-warning";
  return props.actionState
    ? "text-primary font-medium"
    : "text-muted-foreground";
});
</script>
