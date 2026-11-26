<template>
  <div
    v-if="rows.length"
    class="bg-card overflow-hidden rounded-xl border shadow-sm"
  >
    <!-- a row holding a control wraps, so a control too wide for a phone gets
         a line of its own -->
    <component
      :is="rowElement(row, controlled)"
      v-for="{ row, controlled } in rowsWithControls()"
      :key="row.key"
      v-bind="rowAttrs(row, controlled)"
      :data-testid="`${testIdPrefix}-link-${row.key}`"
      class="flex w-full items-center gap-4 border-b px-6 py-4 text-left no-underline last:border-b-0"
      :class="{
        'hover:bg-accent/50 focus-visible:ring-ring transition-colors focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none':
          !controlled && (row.to || row.action),
        'flex-wrap': controlled,
      }"
      @click="!controlled && row.action?.()"
    >
      <SettingsRowContent
        :row="row"
        :test-id-prefix="testIdPrefix"
        :action-state="!!row.actionIcon && !row.busy"
      />
      <slot v-if="controlled" name="control" :row="row" />
      <component
        :is="row.actionIcon"
        v-else-if="row.actionIcon"
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
import type { SettingsRowHead } from "@/components/settings/SettingsRowContent.vue";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface SettingsRow extends SettingsRowHead {
  key: string;
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
import SettingsRowContent from "@/components/settings/SettingsRowContent.vue";
import { hasVNodeContent } from "@/helpers/vnodes";
import { ChevronRight } from "@lucide/vue";
import { RouterLink } from "vue-router";

/**
 * A card of settings rows: each row says what is behind it and opens it,
 * starts it right away, or holds a control of its own, such as a switch or a
 * picker. Renders nothing without rows.
 */
const props = defineProps<{
  rows: readonly SettingsRow[];
  // the start of the test ids of the rows and their parts
  testIdPrefix: string;
}>();

const slots = defineSlots<{
  // the control of a row, at its end in place of the chevron; a row it fills
  // is no link or button itself, so it leaves the control to act
  control?(props: { row: SettingsRow }): unknown;
}>();

// each row, and whether the control slot fills it
function rowsWithControls() {
  return props.rows.map((row) => {
    const control = slots.control?.({ row });
    return {
      row,
      controlled: Array.isArray(control) && hasVNodeContent(control),
    };
  });
}

function rowElement(row: SettingsRow, controlled: boolean) {
  if (controlled) return "div";
  return row.to ? RouterLink : row.action ? "button" : "div";
}

// a row without a navigation or an action only informs, so it is no control
function rowAttrs(row: SettingsRow, controlled: boolean) {
  if (controlled) return {};
  if (row.to) return { to: row.to };
  if (row.action) return { type: "button", disabled: row.busy };
  return {};
}
</script>
