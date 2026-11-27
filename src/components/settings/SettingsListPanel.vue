<template>
  <Card class="gap-5 py-5 md:gap-6 md:py-6">
    <header class="flex flex-col gap-4 px-4 md:px-5">
      <div class="flex items-center gap-3" data-testid="panel-title-row">
        <div class="min-w-0 flex-1">
          <h2 class="m-0 flex items-baseline gap-2 text-base font-semibold">
            {{ title }}
            <span
              v-if="count !== undefined"
              class="text-sm font-normal text-muted-foreground"
              data-testid="panel-count"
            >
              {{ count }}
            </span>
          </h2>
        </div>
        <!-- with no filters to end, a wide header has room for the switch
             before the buttons; a phone has it on the row below -->
        <SettingsViewModeTabs
          v-if="viewMode && !$slots.filters"
          :mode="viewMode"
          class="max-md:hidden"
          @toggle="emit('toggle-view-mode')"
        />
        <div v-if="actions?.length" class="flex shrink-0 items-center gap-1">
          <Button
            v-for="action in actions"
            :key="action.key"
            size="sm"
            :data-testid="action.key"
            @click="action.onSelect()"
          >
            <component :is="action.icon" class="size-4" aria-hidden="true" />
            {{ action.label }}
          </Button>
        </div>
      </div>
      <div
        v-if="$slots.filters || viewMode"
        class="flex items-start justify-end gap-3"
        :class="{ 'md:hidden': !$slots.filters }"
        data-testid="panel-filter-row"
      >
        <div v-if="$slots.filters" class="min-w-0 flex-1">
          <slot name="filters" />
        </div>
        <SettingsViewModeTabs
          v-if="viewMode"
          :mode="viewMode"
          @toggle="emit('toggle-view-mode')"
        />
      </div>
    </header>
    <div class="px-4 md:px-5">
      <slot />
    </div>
  </Card>
</template>

<script lang="ts">
import type { Component } from "vue";

export interface SettingsPanelAction {
  // also the test id of its button
  key: string;
  label: string;
  icon: Component;
  onSelect: () => void;
}
</script>

<script setup lang="ts">
import SettingsViewModeTabs from "@/components/settings/SettingsViewModeTabs.vue";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";

/**
 * A list of a settings page in a panel of its own, whose header holds the title
 * of the list with how many it holds and its actions, then its search and
 * filters, ended by the pills switching between its list and card view.
 */
defineProps<{
  title: string;
  count?: number;
  // the view the list is in; no switch without it
  viewMode?: "list" | "card";
  actions?: readonly SettingsPanelAction[];
}>();

const emit = defineEmits<{
  (e: "toggle-view-mode"): void;
}>();
</script>
