<template>
  <div
    v-if="rows.length"
    class="bg-card overflow-hidden rounded-xl border shadow-sm"
  >
    <component
      :is="row.to ? RouterLink : 'button'"
      v-for="row in rows"
      :key="row.key"
      v-bind="row.to ? { to: row.to } : { type: 'button', disabled: row.busy }"
      :data-testid="`provider-settings-link-${row.key}`"
      class="hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-4 border-b px-4 py-4 text-left no-underline transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
      @click="row.action?.()"
    >
      <component :is="row.icon" class="text-primary size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="text-foreground text-sm font-medium">{{ row.label }}</div>
        <div class="text-muted-foreground truncate text-sm">
          {{ row.description }}
        </div>
      </div>
      <span
        v-if="row.state"
        class="text-muted-foreground flex items-center gap-2 text-sm"
      >
        <RefreshCw
          v-if="row.busy"
          class="size-4 animate-spin"
          aria-hidden="true"
        />
        {{ row.state }}
      </span>
      <ChevronRight
        v-if="row.to"
        class="text-muted-foreground size-4 shrink-0"
      />
    </component>
  </div>
</template>

<script setup lang="ts">
import { useBackgroundTasks } from "@/composables/background-tasks/useBackgroundTasks";
import {
  getListedPlayerConfigs,
  playerBelongsToProviders,
} from "@/helpers/player_config";
import {
  getProviderAccessLabel,
  getProviderSettingsSections,
} from "@/helpers/provider_settings_actions";
import { api } from "@/plugins/api";
import type { PlayerConfig, ProviderConfig } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { ChevronRight, KeyRound, RefreshCw, Speaker } from "@lucide/vue";
import type { Component } from "vue";
import { computed, markRaw, ref, watch } from "vue";
import { RouterLink, type RouteLocationRaw } from "vue-router";

/**
 * The settings of a provider instance that live outside its options: each row
 * says what is behind it and opens it, or starts it right away.
 */
const props = defineProps<{
  config: ProviderConfig;
  // the access record in its compact form, as the sources list shows it
  accessSummary: string;
}>();

const emit = defineEmits<{
  access: [];
}>();

interface SettingsRow {
  key: string;
  icon: Component;
  label: string;
  description: string;
  state?: string;
  // a navigation; a row without one acts on the spot
  to?: RouteLocationRaw;
  action?: () => void;
  busy?: boolean;
}

const { isProviderSyncing } = useBackgroundTasks();

const sections = computed(() => getProviderSettingsSections(props.config));

// the players list this row opens, so the count always matches it; unknown
// until the list loads
const playerConfigs = ref<PlayerConfig[]>();

const playerCount = computed(
  () =>
    playerConfigs.value?.filter((config) =>
      playerBelongsToProviders(config, [props.config.instance_id]),
    ).length,
);

// watchers

// only a player provider has players to count, and it only counts once its
// instance is loaded
watch(
  () => sections.value.players,
  (showsPlayers) => {
    if (showsPlayers) void loadPlayerConfigs();
  },
  { immediate: true },
);

const rows = computed(() => {
  const instanceId = props.config.instance_id;
  const items: SettingsRow[] = [];
  if (sections.value.access) {
    items.push({
      key: "access",
      icon: markRaw(KeyRound),
      label: $t(getProviderAccessLabel()),
      description: $t("settings.source_access.section_description"),
      state: props.accessSummary,
      action: () => emit("access"),
    });
  }
  if (sections.value.players) {
    items.push({
      key: "players",
      icon: markRaw(Speaker),
      label: $t("settings.players"),
      description: $t("settings.provider_players_description"),
      state: playerCount.value?.toString(),
      to: { name: "playersettings", query: { providers: instanceId } },
    });
  }
  if (sections.value.sync) {
    const syncing = isProviderSyncing(instanceId);
    items.push({
      key: "sync",
      icon: markRaw(RefreshCw),
      label: $t("settings.library_sync"),
      description: $t("settings.library_sync_description"),
      state: syncing ? $t("settings.sync_in_progress") : $t("settings.sync"),
      busy: syncing,
      action: () => void api.startSync(undefined, [instanceId]),
    });
  }
  return items;
});

async function loadPlayerConfigs() {
  try {
    playerConfigs.value = await getListedPlayerConfigs();
  } catch (error) {
    // the row still leads to the players, only without the count
    console.error("Error fetching player configs:", error);
  }
}
</script>
