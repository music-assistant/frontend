<template>
  <div>
    <div class="players-header w-100">
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

    <div class="pl-5 font-weight-medium">
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
      <v-list v-if="viewMode === 'list'" class="players-list">
        <ListItem
          v-for="item in filteredPlayers"
          :key="item.player_id"
          link
          :show-menu-btn="true"
          :class="{
            'player-disabled': !item.enabled,
            'player-unavailable': isPlayerUnavailable(
              api.players[item.player_id],
            ),
          }"
          @click="handlePlayerClick(item)"
          @menu="(evt) => onMenu(evt, item)"
        >
          <template #prepend>
            <div class="player-icon-wrapper">
              <PlayerIcon
                :icon="api.players[item.player_id]?.icon"
                :size="20"
                style="left: 3px"
              />
            </div>
          </template>

          <template #title>
            <div class="player-name">
              {{ getPlayerName(item) }}
            </div>
          </template>

          <template #subtitle>
            <div class="player-meta">
              <!-- Player needs setup warning -->
              <PlayerSetupWarning
                v-if="item.enabled && api.players[item.player_id]?.needs_setup"
                @setup="startPlayerSetup(item.player_id)"
              />
              <span v-else class="provider-name">
                {{
                  api.players[item.player_id]?.device_info
                    ? `${api.players[item.player_id].device_info.manufacturer} / ${api.players[item.player_id].device_info.model}`
                    : api.getProviderManifest(item.provider)?.name ||
                      item.provider
                }}
              </span>
              <span class="protocol-chips">
                <ProtocolChip
                  v-for="protocol in getOutputProtocols(item.player_id)"
                  :key="protocol.output_protocol_id"
                  :protocol="protocol"
                />
              </span>
            </div>
          </template>

          <template #append>
            <div class="player-status-icons">
              <v-icon
                v-if="!item.enabled"
                icon="mdi-cancel"
                size="20"
                color="grey"
                :title="$t('settings.player_disabled')"
              />
              <CircleAlert
                v-else-if="api.players[item.player_id]?.needs_setup"
                class="size-5 text-warning"
                :title="$t('settings.player_needs_setup')"
              />
              <v-icon
                v-else-if="isPlayerUnavailable(api.players[item.player_id])"
                icon="mdi-timer-sand"
                size="20"
                color="grey"
                :title="$t('settings.player_not_available')"
              />
            </div>
          </template>
        </ListItem>
      </v-list>

      <div v-else class="players-grid">
        <SettingsPlayerCard
          v-for="item in filteredPlayers"
          :key="item.player_id"
          :player-config="item"
          @click="handlePlayerClick"
          @menu="(evt, config) => onMenu(evt, config)"
          @setup="(config) => startPlayerSetup(config.player_id)"
        />
      </div>

      <div v-if="filteredPlayers.length === 0" class="empty-state">
        <v-icon icon="mdi-speaker-off" size="64" class="empty-icon" />
        <div class="empty-title">{{ $t("no_content") }}</div>
        <div class="empty-message">
          {{ $t("no_content_filter") }}
        </div>
      </div>
    </Container>
    <div class="missing-players-hint">
      <v-icon icon="mdi-information-outline" size="16" class="hint-icon" />
      <i18n-t keypath="settings.missing_players_hint" tag="span" scope="global">
        <router-link
          :to="{ name: 'providersettings', query: { types: 'player' } }"
          class="hint-link"
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
import ListItem from "@/components/ListItem.vue";
import PlayerFilters from "@/components/PlayerFilters.vue";
import ProtocolChip from "@/components/ProtocolChip.vue";
import PlayerIcon from "@/components/PlayerIcon.vue";
import PlayerSetupWarning from "@/components/PlayerSetupWarning.vue";
import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";
import { Button } from "@/components/ui/button";
import {
  getPlayerName,
  getPlayerSettingsMenuItems,
} from "@/helpers/player_settings_actions";
import { isPlayerUnavailable } from "@/helpers/players";
import { isHiddenSendspinWebPlayer } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  PlayerType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { CircleAlert, Plus } from "@lucide/vue";
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
        (x.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER) ||
          x.supported_features.includes(ProviderFeature.SYNC_PLAYERS)),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
});

// methods
const loadItems = async function () {
  playerConfigs.value = (
    await api.getPlayerConfigs(undefined, false, false, true)
  )
    .filter((x) => !isHiddenSendspinWebPlayer(x))
    .sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)));
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

const getOutputProtocols = function (playerId: string) {
  // all output methods for this player, native included
  return api.players[playerId]?.output_protocols || [];
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
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
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
    // Build set of provider domains from selected provider instance_ids for efficient lookup
    const selectedProviderDomains = new Set(
      selectedProviders.value
        .map((instanceId) => api.getProvider(instanceId)?.domain)
        .filter((domain): domain is string => domain !== undefined),
    );

    filtered = filtered.filter((item) => {
      const providerInstance = api.getProvider(item.provider);
      if (!providerInstance) return false;

      // Check if player's provider is selected
      if (selectedProviders.value.includes(providerInstance.instance_id)) {
        return true;
      }

      // Check if any output protocol's domain matches a selected provider domain
      const player = api.players[item.player_id];
      if (player) {
        return player.output_protocols.some((protocol) =>
          selectedProviderDomains.has(protocol.protocol_domain),
        );
      }

      return false;
    });
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

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  width: 100%;
}

.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}

.players-list {
  background: transparent;
}

.player-name {
  font-weight: 500;
  font-size: 16px;
}

.player-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
}

.provider-name {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.7);
}

.protocol-chips {
  display: inline-flex;
  gap: 4px;
  flex-wrap: wrap;
}

@media (max-width: 960px) {
  .protocol-chips {
    display: none;
  }
}

.player-status-icons {
  display: flex;
  align-items: center;
  gap: 8px;
}

.player-icon-wrapper {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  height: 40px;
  border-radius: 50%;
  background: rgba(var(--v-theme-primary), 0.15);
}

.players-grid {
  display: grid;
  grid-template-columns: 1fr;
  grid-auto-rows: auto;
  gap: 24px;
}

@media (min-width: 960px) {
  .players-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1264px) {
  .players-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.player-disabled {
  opacity: 0.6;
}

.player-unavailable {
  opacity: 0.7;
}

.missing-players-hint {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 16px 20px;
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
}

.hint-icon {
  color: rgba(var(--v-theme-on-surface), 0.4);
  flex-shrink: 0;
}

.hint-link {
  color: rgb(var(--v-theme-primary));
  text-decoration: none;
}

.hint-link:hover {
  text-decoration: underline;
}
</style>
