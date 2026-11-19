<template>
  <div v-if="tiles.length" class="@container">
    <!-- the room beside the sidebar decides the columns, not the screen width -->
    <div class="grid grid-cols-1 gap-3 @3xl:grid-cols-2">
      <RouterLink
        v-for="tile in tiles"
        :key="tile.key"
        :to="tile.to"
        :data-testid="`${testIdPrefix}-link-${tile.key}`"
        class="group flex items-center gap-3 rounded-(--radius-xl) border bg-card p-4 text-inherit no-underline shadow-sm transition-colors outline-none hover:bg-accent/50 focus-visible:ring-[3px] focus-visible:ring-ring/50"
      >
        <SettingsIcon :icon="tile.icon" :color="tile.color" soft />
        <div class="min-w-0 flex-1">
          <div class="truncate text-sm font-medium text-foreground">
            {{ tile.label }}
          </div>
          <div
            :data-testid="`${testIdPrefix}-description`"
            class="line-clamp-2 text-[13px] leading-snug text-muted-foreground"
          >
            {{ tile.description }}
          </div>
        </div>
        <span
          v-if="tile.state"
          :data-testid="`${testIdPrefix}-state`"
          class="shrink-0 text-sm whitespace-nowrap text-muted-foreground"
        >
          {{ tile.state }}
        </span>
        <ChevronRight
          class="size-4 shrink-0 text-muted-foreground transition-colors group-hover:text-foreground"
          aria-hidden="true"
        />
      </RouterLink>
    </div>
  </div>
</template>

<script lang="ts">
import type { SettingsColor } from "@/helpers/settings_colors";
import type { Component } from "vue";
import type { RouteLocationRaw } from "vue-router";

export interface SettingsTile {
  key: string;
  icon: Component;
  color: SettingsColor;
  label: string;
  description: string;
  // what the page behind it holds, such as how many providers run
  state?: string;
  to: RouteLocationRaw;
}
</script>

<script setup lang="ts">
import SettingsIcon from "@/components/settings/SettingsIcon.vue";
import { ChevronRight } from "@lucide/vue";
import { RouterLink } from "vue-router";

/**
 * The tiles of a hub, each leading to a page below it. Renders nothing without
 * tiles.
 */
defineProps<{
  tiles: readonly SettingsTile[];
  // the start of the test ids of the tiles and their parts
  testIdPrefix: string;
}>();
</script>
