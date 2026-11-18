<template>
  <div
    v-if="rows.length"
    class="bg-card overflow-hidden rounded-xl border shadow-sm"
  >
    <component
      :is="row.to ? RouterLink : row.action ? 'button' : 'div'"
      v-for="row in rows"
      :key="row.key"
      v-bind="rowAttrs(row)"
      :data-testid="`${testIdPrefix}-link-${row.key}`"
      class="flex w-full items-center gap-4 border-b px-6 py-4 text-left no-underline last:border-b-0"
      :class="{
        'hover:bg-accent/50 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none':
          row.to || row.action,
      }"
      @click="row.action?.()"
    >
      <component :is="row.icon" class="text-primary size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="text-foreground text-sm font-medium">{{ row.label }}</div>
        <!-- a problem wraps instead of being cut off, so its reason stays readable -->
        <div
          :data-testid="`${testIdPrefix}-description`"
          class="text-sm"
          :class="
            row.error ? 'text-destructive' : 'text-muted-foreground truncate'
          "
        >
          {{ row.description }}
        </div>
        <!-- a phone has no room beside the label, so the state gets a line of its own -->
        <div
          v-if="row.state"
          :data-testid="`${testIdPrefix}-state-below`"
          class="text-sm sm:hidden"
          :class="stateClass(row)"
        >
          {{ row.state }}
        </div>
      </div>
      <span
        v-if="row.state"
        :data-testid="`${testIdPrefix}-state`"
        class="hidden max-w-[45%] truncate text-sm sm:block"
        :class="stateClass(row)"
        :title="row.stateTitle ?? row.state"
      >
        {{ row.state }}
      </span>
      <component
        :is="row.actionIcon"
        v-if="row.actionIcon"
        class="text-primary size-4 shrink-0"
        :class="{ 'animate-spin': row.busy }"
        aria-hidden="true"
      />
      <ChevronRight
        v-else-if="row.to"
        class="text-muted-foreground size-4 shrink-0"
      />
    </component>
  </div>
</template>

<script lang="ts">
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface SettingsRow {
  key: string;
  icon: Component;
  label: string;
  description: string;
  state?: string;
  // the hover text of the state, the state itself by default
  stateTitle?: string;
  // the row reports a problem: the description gives its reason
  error?: boolean;
  // a navigation; a row without one acts on the spot, or only informs when it
  // has no action either
  to?: RouteLocationRaw;
  action?: () => unknown;
  // shown at the end of a row that acts on the spot, turning while it is busy
  actionIcon?: Component;
  busy?: boolean;
}
</script>

<script setup lang="ts">
import { ChevronRight } from "@lucide/vue";
import { RouterLink } from "vue-router";

/**
 * A card of settings rows: each row says what is behind it and opens it, or
 * starts it right away. Renders nothing without rows.
 */
defineProps<{
  rows: readonly SettingsRow[];
  // the start of the test ids of the rows and their parts
  testIdPrefix: string;
}>();

// a row without a navigation or an action only informs, so it is no control
function rowAttrs(row: SettingsRow) {
  if (row.to) return { to: row.to };
  if (row.action) return { type: "button", disabled: row.busy };
  return {};
}

// a state reporting a problem reads as one; a row that acts on the spot reads as
// an action until it is busy
function stateClass(row: SettingsRow) {
  if (row.error) return "text-destructive";
  return row.actionIcon && !row.busy
    ? "text-primary font-medium"
    : "text-muted-foreground";
}
</script>
