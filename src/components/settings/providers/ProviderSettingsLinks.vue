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
      class="hover:bg-accent/50 focus-visible:ring-ring flex w-full items-center gap-4 border-b px-6 py-4 text-left no-underline transition-colors last:border-b-0 focus-visible:ring-2 focus-visible:outline-none disabled:pointer-events-none"
      @click="row.action?.()"
    >
      <component :is="row.icon" class="text-primary size-5 shrink-0" />
      <div class="min-w-0 flex-1">
        <div class="text-foreground text-sm font-medium">{{ row.label }}</div>
        <div class="text-muted-foreground truncate text-sm">
          {{ row.description }}
        </div>
        <!-- a phone has no room beside the label, so the state gets a line of its own -->
        <div
          v-if="row.state"
          data-testid="provider-settings-state-below"
          class="text-sm sm:hidden"
          :class="stateClass(row)"
        >
          {{ row.state }}
        </div>
      </div>
      <span
        v-if="row.state"
        data-testid="provider-settings-state"
        class="hidden max-w-[45%] truncate text-sm sm:block"
        :class="stateClass(row)"
        :title="row.state"
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
import {
  EventType,
  type PlayerConfig,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import {
  ChevronRight,
  KeyRound,
  LibraryBig,
  RefreshCw,
  Speaker,
} from "@lucide/vue";
import { useDebounceFn } from "@vueuse/core";
import type { Component } from "vue";
import { computed, markRaw, onBeforeUnmount, ref, watch } from "vue";
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
  action?: () => unknown;
  // shown at the end of a row that acts on the spot, turning while it is busy
  actionIcon?: Component;
  busy?: boolean;
}

const { isProviderSyncing } = useBackgroundTasks();

const sections = computed(() => getProviderSettingsSections(props.config));

// the players list this row opens, so the count always matches it; unknown
// until the list loads
const playerConfigs = ref<PlayerConfig[]>();
let playerConfigsRequestId = 0;

const playerCount = computed(
  () =>
    playerConfigs.value?.filter((config) =>
      playerBelongsToProviders(config, [props.config.instance_id]),
    ).length,
);

// watchers

// only a player provider has players to count, and it only counts once its
// instance is loaded; a provider that was just enabled discovers its players
// after that, so the count follows them
let unsubPlayersChanged: (() => void) | undefined;
// discovery announces its players one by one, so a burst reloads the list once
const reloadPlayerConfigs = useDebounceFn(loadPlayerConfigs, 300);
watch(
  () => sections.value.players,
  (showsPlayers) => {
    unsubPlayersChanged?.();
    unsubPlayersChanged = undefined;
    if (!showsPlayers) return;
    void loadPlayerConfigs();
    unsubPlayersChanged = api.subscribe_multi(
      [
        EventType.PLAYER_ADDED,
        EventType.PLAYER_CONFIG_UPDATED,
        EventType.PLAYER_REMOVED,
      ],
      () => void reloadPlayerConfigs(),
    );
  },
  { immediate: true },
);
onBeforeUnmount(() => unsubPlayersChanged?.());

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
      icon: markRaw(LibraryBig),
      label: $t("settings.library_sync"),
      description: $t("settings.library_sync_description"),
      state: syncing ? $t("settings.sync_in_progress") : $t("settings.sync"),
      busy: syncing,
      actionIcon: markRaw(RefreshCw),
      action: () => api.startSync(undefined, [instanceId]),
    });
  }
  return items;
});

// a row that acts on the spot reads as an action until it is busy
function stateClass(row: SettingsRow) {
  return row.actionIcon && !row.busy
    ? "text-primary font-medium"
    : "text-muted-foreground";
}

async function loadPlayerConfigs() {
  // player events come in bursts, so only the latest request may set the count
  const requestId = ++playerConfigsRequestId;
  try {
    const configs = await getListedPlayerConfigs();
    if (requestId === playerConfigsRequestId) playerConfigs.value = configs;
  } catch (error) {
    if (requestId !== playerConfigsRequestId) return;
    // the row still leads to the players, only without the count
    playerConfigs.value = undefined;
    console.error("Error fetching player configs:", error);
  }
}
</script>
