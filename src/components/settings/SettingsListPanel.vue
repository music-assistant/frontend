<template>
  <Card class="gap-5 py-5 md:gap-6 md:py-6">
    <header
      class="grid grid-cols-[minmax(0,1fr)_auto_auto] items-center gap-x-3 gap-y-4 px-4 md:px-5"
    >
      <div class="col-start-1 row-start-1 min-w-0">
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
      <!-- on a phone the switch sits by the title; wider, it ends the row of
           the search and filters, or comes before the buttons without them -->
      <SettingsViewModeTabs
        v-if="viewMode"
        :mode="viewMode"
        class="col-start-2 row-start-1"
        :class="{
          'md:col-start-3 md:row-start-2 md:self-start md:justify-self-end':
            $slots.filters,
        }"
        @toggle="emit('toggle-view-mode')"
      />
      <div
        class="col-start-3 row-start-1 flex items-center gap-1 justify-self-end"
      >
        <Button
          v-for="action in actions ?? []"
          :key="action.key"
          size="sm"
          class="max-md:hidden"
          :data-testid="action.key"
          @click="action.onSelect()"
        >
          <component :is="action.icon" class="size-4" aria-hidden="true" />
          {{ action.label }}
        </Button>
        <!-- a phone has no room for the buttons, so they move into a menu -->
        <DropdownMenu v-if="actions?.length">
          <DropdownMenuTrigger as-child>
            <Button
              variant="ghost"
              size="icon-sm"
              class="md:hidden"
              :title="$t('more_options')"
              :aria-label="$t('more_options')"
              data-testid="panel-menu"
            >
              <EllipsisVertical class="size-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem
              v-for="action in actions"
              :key="action.key"
              :data-testid="`${action.key}-menu`"
              @select="action.onSelect()"
            >
              <component :is="action.icon" aria-hidden="true" />
              {{ action.label }}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <div
        v-if="$slots.filters"
        class="col-span-3 col-start-1 row-start-2 min-w-0 md:col-span-2"
      >
        <slot name="filters" />
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { $t } from "@/plugins/i18n";
import { EllipsisVertical } from "@lucide/vue";

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
