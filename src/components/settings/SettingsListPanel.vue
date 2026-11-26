<template>
  <Card class="@container/panel gap-4 py-4 md:gap-5 md:py-5">
    <header class="flex flex-wrap items-center gap-x-3 gap-y-3 px-4 md:px-5">
      <div class="min-w-0 flex-1 @4xl/panel:flex-none">
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
      <!-- the search and filters sit between the title and the buttons once
           the panel is wide enough, and get a row of their own below it -->
      <div
        v-if="$slots.filters"
        class="order-[1] min-w-0 basis-full @4xl/panel:order-[0] @4xl/panel:flex-1 @4xl/panel:basis-0"
      >
        <slot name="filters" />
      </div>
      <div class="ml-auto flex shrink-0 items-center gap-1">
        <SettingsViewModeToggle
          v-if="viewMode"
          :mode="viewMode"
          small
          @toggle="emit('toggle-view-mode')"
        />
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
import SettingsViewModeToggle from "@/components/settings/SettingsViewModeToggle.vue";
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
 * of the list with how many it holds, its search and filters, the switch
 * between its list and card view, and its actions.
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
