<template>
  <div>
    <SettingsPageLinks
      class="mx-5 mt-5"
      section="players"
      :extra-rows="playerSupportRows"
    />
    <div class="players-header w-full">
      <PlayerFilters
        @update:search="searchQuery = $event"
        @update:providers="selectedProviders = $event"
        @update:types="selectedPlayerTypes = $event"
        @update:statuses="selectedStatuses = $event"
      />
      <div class="header-actions">
        <Button
          v-if="providersWithCreateGroupSupport.length > 0"
          class="add-player-group-btn"
          @click="showAddPlayerGroupDialog = true"
        >
          <Plus class="size-4" />
          {{ $t("settings.add_group_player") }}
        </Button>
      </div>
    </div>

    <div class="pl-5 font-medium">
      {{
        $t("settings.players_total", filteredPlayers.length, {
          named: { count: filteredPlayers.length },
        })
      }}
    </div>
    <div
      class="mt-4 px-5 py-2.5"
      :class="{ 'bg-background dark:bg-transparent': viewMode !== 'list' }"
    >
      <div class="space-y-6">
        <section
          v-for="section in sections"
          :key="section.key"
          class="space-y-3"
          data-testid="player-section"
          :data-section="section.key"
        >
          <!-- a single section needs no heading -->
          <h2
            v-if="sections.length > 1"
            class="text-muted-foreground text-sm font-medium"
          >
            {{ $t(section.label) }}
          </h2>
          <ItemGroup v-if="viewMode === 'list'" class="gap-2">
            <SettingsPlayerRow
              v-for="item in section.items"
              :key="item.player_id"
              :player-config="item"
              @click="handlePlayerClick"
              @menu="(evt, config) => onMenu(evt, config)"
              @setup="(config) => startPlayerSetup(config.player_id)"
            />
          </ItemGroup>

          <div
            v-else
            class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3"
          >
            <SettingsPlayerCard
              v-for="item in section.items"
              :key="item.player_id"
              :player-config="item"
              @click="handlePlayerClick"
              @menu="(evt, config) => onMenu(evt, config)"
              @setup="(config) => startPlayerSetup(config.player_id)"
            />
          </div>
        </section>
      </div>

      <FilterEmptyState
        v-if="filteredPlayers.length === 0"
        :icon="VolumeOff"
        data-testid="players-empty"
      />
    </div>
    <div
      v-if="canAddPlayerProviders"
      class="missing-players-hint flex items-center justify-center gap-1.5 px-5 py-4 text-[13px] text-muted-foreground"
    >
      <Info class="size-4 shrink-0" aria-hidden="true" />
      <i18n-t keypath="settings.missing_players_hint" tag="span" scope="global">
        <router-link
          :to="PLAYER_PROVIDERS_ROUTE"
          class="text-primary no-underline hover:underline"
        >
          {{ $t("settings.add_player_providers") }}
        </router-link>
      </i18n-t>
    </div>
    <AddPlayerGroupDialog v-model:show="showAddPlayerGroupDialog" />
  </div>
</template>

<script setup lang="ts">
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import PlayerFilters from "@/components/PlayerFilters.vue";
import SettingsPlayerRow from "@/components/settings/players/SettingsPlayerRow.vue";
import type { SettingsRow } from "@/components/settings/SettingsLinkRows.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";

import type { ToolBarMenuItem } from "@/components/Toolbar.vue";
import { useSettingsPlayerList } from "@/composables/settings/players/useSettingsPlayerList";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import { useSettingsToolbarMenu } from "@/composables/useSettingsToolbarMenu";
import {
  getPlayerSettingsMenuItems,
  removeUnavailablePlayers,
} from "@/helpers/player_settings_actions";

import { api } from "@/plugins/api";
import {
  PlayerConfig,
  ProviderFeature,
  ProviderType,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { EyeOff, Info, Plus, Speaker, Trash2, VolumeOff } from "@lucide/vue";
import { computed, inject, markRaw, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AddPlayerGroupDialog from "./AddPlayerGroupDialog.vue";

// the list of the player providers
const PLAYER_PROVIDERS_ROUTE = {
  name: "providersettings",
  query: { types: ProviderType.PLAYER },
};

// global refs
const router = useRouter();

const playersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("playersViewMode")!;

const viewMode = computed(() => playersViewMode.viewMode.value);

const {
  playerConfigs,
  searchQuery,
  selectedProviders,
  selectedPlayerTypes,
  selectedStatuses,
  hideUnavailable,
  filteredPlayers,
  sections,
  toggleHideUnavailable,
  dropPlayerConfigs,
  loadItems,
} = useSettingsPlayerList();

// local refs
const showAddPlayerGroupDialog = ref<boolean>(false);

// computed properties
const providersWithCreateGroupSupport = computed(() => {
  // providers available with create_group support
  return Object.values(api.providers)
    .filter(
      (x) =>
        x.available &&
        x.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
});
// the hint leads to adding player providers, which takes config.providers.write
const canAddPlayerProviders = computed(() =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
);
const canRemovePlayers = computed(() =>
  authManager.hasScope(Scope.CONFIG_PLAYERS_WRITE),
);

// the row to the player providers, with how many of them run
const playerSupportRows = computed<SettingsRow[]>(() => {
  if (!canAddPlayerProviders.value) return [];
  const count = Object.values(api.providers).filter(
    (provider) => provider.type === ProviderType.PLAYER,
  ).length;
  return [
    {
      key: "player_support",
      icon: markRaw(Speaker),
      label: $t("settings.playerproviders"),
      description: $t("settings.player_providers_description"),
      state: $t("settings.providers_active", count, { named: { count } }),
      to: PLAYER_PROVIDERS_ROUTE,
    },
  ];
});

const toolbarMenu = useSettingsToolbarMenu();
const toolbarMenuItems = computed<ToolBarMenuItem[]>(() => {
  const items: ToolBarMenuItem[] = [
    {
      label: "settings.hide_unavailable_players",
      icon: markRaw(EyeOff),
      action: toggleHideUnavailable,
      active: hideUnavailable.value,
    },
  ];
  if (canRemovePlayers.value) {
    items.push({
      label: "settings.remove_unavailable_players",
      icon: markRaw(Trash2),
      // the server decides which players it removes, whatever the list shows
      action: () =>
        removeUnavailablePlayers(playerConfigs.value, dropPlayerConfigs),
    });
  }
  return items;
});
watch(
  toolbarMenuItems,
  (items) => {
    toolbarMenu.value = items;
  },
  { immediate: true },
);
onBeforeUnmount(() => {
  toolbarMenu.value = [];
});

// methods
const editPlayer = function (playerId: string) {
  router.push(`/settings/editplayer/${playerId}`);
};

const startPlayerSetup = function (playerId: string) {
  eventbus.emit("setupFlowDialog", { kind: "player", playerId });
};

const handlePlayerClick = function (playerConfig: PlayerConfig) {
  if (
    playerConfig.enabled &&
    api.players[playerConfig.player_id]?.needs_setup
  ) {
    startPlayerSetup(playerConfig.player_id);
    return;
  }
  editPlayer(playerConfig.player_id);
};

const onMenu = function (evt: Event, playerConfig: PlayerConfig) {
  // the list has no PLAYER_REMOVED/PLAYER_CONFIG_REMOVED subscription, so a
  // deleted player has to be dropped from it here
  const menuItems = getPlayerSettingsMenuItems(playerConfig, {
    includeSections: true,
    onDeleted: () => dropPlayerConfigs([playerConfig.player_id]),
    // one player went
    onMerged: () => void loadItems(),
  });
  const position = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: position.x,
    posY: position.y,
  });
};
</script>

<style scoped>
.players-header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 20px 6px 20px;
}

.header-actions {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 8px;
  flex-shrink: 0;
  align-self: flex-start;
}

.add-player-group-btn {
  flex-shrink: 0;
  align-self: flex-start;
  margin-top: 0;
}

.players-header :deep(.filters-container) {
  align-items: flex-start;
}

.players-header :deep(.filter-buttons) {
  align-items: center;
}

@media (max-width: 960px) {
  .players-header {
    flex-direction: column;
    align-items: stretch;
  }

  .header-actions {
    width: 100%;
    justify-content: space-between;
    align-self: stretch;
  }

  .add-player-group-btn {
    flex: 1;
    align-self: stretch;
    margin-top: 0;
  }
}

@media (min-width: 961px) and (max-width: 1400px) {
  .players-header {
    flex-wrap: wrap;
    align-items: flex-end;
  }

  .add-player-group-btn {
    margin-top: 0;
    align-self: flex-end;
  }

  .players-header :deep(.filters-container) {
    align-items: flex-end;
  }
}
</style>
