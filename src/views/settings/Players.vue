<template>
  <div>
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
    <Container
      :variant="viewMode === 'list' ? 'default' : 'panel'"
      class="mt-4 px-5"
    >
      <ItemGroup v-if="viewMode === 'list'" class="gap-2">
        <SettingsPlayerRow
          v-for="item in filteredPlayers"
          :key="item.player_id"
          :player-config="item"
          @click="handlePlayerClick"
          @menu="(evt, config) => onMenu(evt, config)"
          @setup="(config) => startPlayerSetup(config.player_id)"
        />
      </ItemGroup>

      <div v-else class="grid grid-cols-1 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <SettingsPlayerCard
          v-for="item in filteredPlayers"
          :key="item.player_id"
          :player-config="item"
          @click="handlePlayerClick"
          @menu="(evt, config) => onMenu(evt, config)"
          @setup="(config) => startPlayerSetup(config.player_id)"
        />
      </div>

      <FilterEmptyState
        v-if="filteredPlayers.length === 0"
        :icon="VolumeOff"
        data-testid="players-empty"
      />
    </Container>
    <div
      v-if="canAddPlayerProviders"
      class="missing-players-hint flex items-center justify-center gap-1.5 px-5 py-4 text-[13px] text-muted-foreground"
    >
      <Info class="size-4 shrink-0" aria-hidden="true" />
      <i18n-t keypath="settings.missing_players_hint" tag="span" scope="global">
        <router-link
          :to="{ name: 'providersettings', query: { types: 'player' } }"
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
import Container from "@/components/Container.vue";
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import PlayerFilters from "@/components/PlayerFilters.vue";
import SettingsPlayerRow from "@/components/settings/players/SettingsPlayerRow.vue";
import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";
import { Button } from "@/components/ui/button";
import { ItemGroup } from "@/components/ui/item";

import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import {
  getListedPlayerConfigs,
  getPlayerName,
  playerBelongsToProviders,
} from "@/helpers/player_config";
import { getPlayerSettingsMenuItems } from "@/helpers/player_settings_actions";

import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  PlayerType,
  ProviderFeature,
  Scope,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { Info, Plus, VolumeOff } from "@lucide/vue";
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AddPlayerGroupDialog from "./AddPlayerGroupDialog.vue";

// global refs
const router = useRouter();

const playersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("playersViewMode")!;

const viewMode = computed(() => playersViewMode.viewMode.value);

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
const searchQuery = ref<string>("");
const selectedProviders = ref<string[]>([]);
const selectedPlayerTypes = ref<string[]>([]);
const selectedStatuses = ref<string[]>([]);
const showAddPlayerGroupDialog = ref<boolean>(false);

// listen for item updates to refresh items when that happens
const unsub = api.subscribe_multi([EventType.PLAYER_CONFIG_UPDATED], () => {
  loadItems();
});
onBeforeUnmount(unsub);

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

// methods
const loadItems = async function () {
  playerConfigs.value = (await getListedPlayerConfigs()).sort((a, b) =>
    getPlayerName(a).localeCompare(getPlayerName(b)),
  );
};

const editPlayer = function (playerId: string, provider: string) {
  if (api.getProvider(provider)) {
    // only allow edit if provider is available
    router.push(`/settings/editplayer/${playerId}`);
  }
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
  editPlayer(playerConfig.player_id, playerConfig.provider);
};

const onMenu = function (evt: Event, playerConfig: PlayerConfig) {
  // the list has no PLAYER_REMOVED/PLAYER_CONFIG_REMOVED subscription, so a
  // deleted player has to be dropped from it here
  const menuItems = getPlayerSettingsMenuItems(playerConfig, {
    includeSections: true,
    onDeleted: () => {
      playerConfigs.value = playerConfigs.value.filter(
        (x) => x.player_id !== playerConfig.player_id,
      );
    },
  });
  const position = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: position.x,
    posY: position.y,
  });
};

const filteredPlayers = computed(() => {
  let filtered = [...playerConfigs.value];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((item) => {
      const playerName = getPlayerName(item).toLowerCase();
      const providerName = (
        api.getProviderManifest(item.provider)?.name || item.provider
      ).toLowerCase();
      return playerName.includes(query) || providerName.includes(query);
    });
  }

  if (selectedProviders.value.length > 0) {
    filtered = filtered.filter((item) =>
      playerBelongsToProviders(item, selectedProviders.value),
    );
  }

  if (selectedPlayerTypes.value.length > 0) {
    filtered = filtered.filter((item) => {
      const player = api.players[item.player_id];
      const playerType = player?.type ?? PlayerType.PLAYER;
      return selectedPlayerTypes.value.includes(playerType);
    });
  }

  if (selectedStatuses.value.length > 0) {
    filtered = filtered.filter((item) => {
      const player = api.players[item.player_id];
      return selectedStatuses.value.some((status) => {
        if (status === "available") {
          // serialized available is false while a player needs setup
          return item.enabled && player?.available;
        }
        if (status === "needs_setup") {
          return item.enabled && player?.needs_setup;
        }
        if (status === "unavailable") {
          return item.enabled && !player?.available && !player?.needs_setup;
        }
        return status === "disabled" && !item.enabled;
      });
    });
  }

  return filtered.sort((a, b) =>
    getPlayerName(a).localeCompare(getPlayerName(b)),
  );
});

// watchers
watch(
  () => api.players,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
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
