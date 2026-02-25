<template>
  <div>
    <div class="players-header w-100">
      <PlayerFilters
        @update:search="searchQuery = $event"
        @update:providers="selectedProviders = $event"
        @update:types="selectedPlayerTypes = $event"
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
        $t("settings.players_total", [
          getAllFilteredPlayers().length,
          getAllFilteredPlayers().length !== 1 ? "s" : "",
        ])
      }}
    </div>
    <Container
      :variant="viewMode === 'list' ? 'default' : 'panel'"
      class="mt-4"
    >
      <v-list v-if="viewMode === 'list'" class="players-list">
        <ListItem
          v-for="item in getAllFilteredPlayers()"
          :key="item.player_id"
          link
          :show-menu-btn="true"
          :class="{
            'player-disabled': !item.enabled,
            'player-unavailable': !api.players[item.player_id]?.available,
            'player-needs-setup':
              item.enabled && api.players[item.player_id]?.needs_setup,
          }"
          @click="editPlayer(item.player_id, item.provider)"
          @menu="(evt) => onMenu(evt, item)"
        >
          <template #prepend>
            <div class="player-icon-wrapper">
              <v-icon
                :icon="api.players[item.player_id]?.icon || 'mdi-speaker'"
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
              <div
                v-if="item.enabled && api.players[item.player_id]?.needs_setup"
                class="player-warning-inline"
              >
                <v-icon icon="mdi-alert-circle" size="16" color="warning" />
                <span class="player-warning-text">{{
                  $t("settings.player_needs_setup")
                }}</span>
              </div>
              <span v-else class="provider-name">
                {{
                  api.players[item.player_id]?.device_info
                    ? `${api.players[item.player_id].device_info.manufacturer} / ${api.players[item.player_id].device_info.model}`
                    : api.getProviderManifest(item.provider)?.name ||
                      item.provider
                }}
              </span>
              <span class="protocol-chips">
                <v-chip
                  v-for="protocol in getOutputProtocols(item.player_id)"
                  :key="protocol.output_protocol_id"
                  size="x-small"
                  variant="tonal"
                  class="protocol-chip"
                >
                  <template #prepend>
                    <ProviderIcon
                      :domain="protocol.protocol_domain!"
                      :size="14"
                      class="chip-icon"
                    />
                  </template>
                  {{
                    api.getProviderManifest(protocol.protocol_domain!)?.name ||
                    protocol.protocol_domain
                  }}
                </v-chip>
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
              <v-icon
                v-else-if="api.players[item.player_id]?.needs_setup"
                icon="mdi-alert-circle"
                size="20"
                color="warning"
                :title="$t('settings.player_needs_setup')"
              />
              <v-icon
                v-else-if="!api.players[item.player_id]?.available"
                icon="mdi-timer-sand"
                size="20"
                color="grey"
                :title="$t('settings.player_not_available')"
              />
            </div>
          </template>
        </ListItem>
      </v-list>

      <v-row v-else>
        <v-col
          v-for="item in getAllFilteredPlayers()"
          :key="item.player_id"
          cols="12"
          md="6"
          lg="4"
          class="d-flex"
        >
          <SettingsPlayerCard
            :player-config="item"
            @click="(config) => editPlayer(config.player_id, config.provider)"
            @menu="(evt, config) => onMenu(evt, config)"
          />
        </v-col>
      </v-row>

      <div v-if="getAllFilteredPlayers().length === 0" class="empty-state">
        <v-icon icon="mdi-speaker-off" size="64" class="empty-icon" />
        <div class="empty-title">{{ $t("no_content") }}</div>
        <div class="empty-message">
          {{ $t("no_content_filter") }}
        </div>
      </div>
    </Container>
    <AddPlayerGroupDialog v-model:show="showAddPlayerGroupDialog" />
  </div>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import PlayerFilters from "@/components/PlayerFilters.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import SettingsPlayerCard from "@/components/SettingsPlayerCard.vue";
import { Button } from "@/components/ui/button";
import { SYNCGROUP_PREFIX } from "@/constants";
import { isHiddenSendspinWebPlayer, openLinkInNewTab } from "@/helpers/utils";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  PlayerType,
  ProviderFeature,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { Plus } from "lucide-vue-next";
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

const removePlayer = function (playerId: string) {
  api.removePlayer(playerId).then(() => {
    playerConfigs.value = playerConfigs.value.filter(
      (x) => x.player_id != playerId,
    );
  });
};

const editPlayer = function (playerId: string, provider: string) {
  if (api.getProvider(provider)) {
    // only allow edit if provider is available
    router.push(`/settings/editplayer/${playerId}`);
  }
};

const editPlayerDsp = function (playerId: string) {
  router.push(`/settings/editplayer/${playerId}/dsp`);
};

const playerCanBeDeleted = function (playerId: string) {
  const player = api.players[playerId];
  if (!player) return true;
  if (player.type === PlayerType.GROUP) {
    return api
      .getProvider(player.provider)
      ?.supported_features.includes(ProviderFeature.REMOVE_GROUP_PLAYER);
  }
  return api
    .getProvider(player.provider)
    ?.supported_features.includes(ProviderFeature.REMOVE_PLAYER);
};

const toggleEnabled = function (config: PlayerConfig) {
  config.enabled = !config.enabled;
  api.savePlayerConfig(config.player_id, { enabled: config.enabled });
};

const getPlayerName = function (playerConfig: PlayerConfig) {
  return (
    playerConfig.name ||
    api.players[playerConfig.player_id]?.name ||
    playerConfig.default_name ||
    playerConfig.player_id
  );
};

const getOutputProtocols = function (playerId: string) {
  // Return only non-native protocols (ones with a protocol_domain)
  return api.players[playerId]?.output_protocols || [];
};

const onMenu = function (evt: Event, playerConfig: PlayerConfig) {
  const menuItems: ContextMenuItem[] = [
    {
      label: "settings.configure",
      labelArgs: [],
      action: () => {
        editPlayer(playerConfig.player_id, playerConfig.provider);
      },
      icon: "mdi-cog",
      disabled: !api.getProvider(playerConfig!.provider),
    },
    {
      label: "open_dsp_settings",
      labelArgs: [],
      action: () => {
        editPlayerDsp(playerConfig.player_id);
      },
      icon: "mdi-equalizer",
      hide: api.players[playerConfig.player_id]?.type === PlayerType.GROUP,
    },
    {
      label: playerConfig.enabled ? "settings.disable" : "settings.enable",
      labelArgs: [],
      action: () => {
        toggleEnabled(playerConfig);
      },
      icon: "mdi-cancel",
      hide: !api.getProvider(playerConfig!.provider),
    },
    {
      label: "settings.documentation",
      labelArgs: [],
      action: () => {
        openLinkInNewTab(
          api.getProviderManifest(playerConfig!.provider)?.documentation || "",
        );
      },
      icon: "mdi-bookshelf",
      disabled: !api.getProviderManifest(playerConfig!.provider)?.documentation,
    },
    {
      label: "settings.delete",
      labelArgs: [],
      action: () => {
        removePlayer(playerConfig.player_id);
      },
      icon: "mdi-delete",
      hide: !playerCanBeDeleted(playerConfig.player_id),
    },
  ];
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

const getAllFilteredPlayers = function () {
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
      if (player?.output_protocols) {
        return player.output_protocols.some(
          (protocol) =>
            protocol.protocol_domain &&
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

  return filtered.sort((a, b) =>
    getPlayerName(a).localeCompare(getPlayerName(b)),
  );
};

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

.protocol-chip {
  text-transform: uppercase;
  font-size: 10px;
  letter-spacing: 0.3px;
}

.chip-icon {
  margin: 0 !important;
  width: auto !important;
}

.chip-icon :deep(div) {
  margin-left: 0 !important;
  margin-right: 4px !important;
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper) {
  width: 14px !important;
  height: 14px !important;
}

.chip-icon :deep(.svg-wrapper svg) {
  width: 14px !important;
  height: 14px !important;
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

.player-disabled {
  opacity: 0.6;
}

.player-unavailable {
  opacity: 0.7;
}

.player-needs-setup {
  border-left: 3px solid rgb(var(--v-theme-warning));
}

.player-warning-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--v-theme-warning));
}

.player-warning-text {
  font-size: 13px;
  font-weight: 500;
}
</style>
