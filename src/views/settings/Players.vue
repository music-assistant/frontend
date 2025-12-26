<template>
  <div class="players-settings">
    <v-container class="pa-4 mx-auto" style="max-width: 600px">
      <div class="d-flex align-center justify-space-between mb-4">
        <v-text-field
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          :label="$t('search')"
          single-line
          hide-details
          variant="outlined"
          density="comfortable"
          class="search-field mr-4"
          clearable
        />
        <v-btn
          v-if="providersWithCreateGroupSupport.length > 0"
          color="primary"
          prepend-icon="mdi-plus"
          @click="showAddPlayerGroupDialog = true"
        >
          {{ $t("settings.add_group_player") }}
        </v-btn>
      </div>

      <div class="text-subtitle-2 text-medium-emphasis mb-2 ml-1">
        {{
          $t("settings.players_total", [
            getAllFilteredPlayers().length,
            getAllFilteredPlayers().length !== 1 ? "s" : "",
          ])
        }}
      </div>

      <div
        v-if="getAllFilteredPlayers().length === 0"
        class="d-flex flex-column align-center justify-center py-6 border rounded-lg"
      >
        <v-icon icon="mdi-speaker-off" size="64" class="text-disabled mb-4" />
        <p class="text-medium-emphasis">{{ $t("no_content") }}</p>
      </div>
      <v-list v-else lines="two" class="bg-transparent pa-0">
        <ListItem
          v-for="item in getAllFilteredPlayers()"
          :key="item.player_id"
          link
          :show-menu-btn="true"
          class="settings-item py-3 mb-3 rounded-lg border"
          elevation="0"
          :class="{
            'player-disabled': !item.enabled,
            'player-unavailable': !api.players[item.player_id]?.available,
          }"
          @click="editPlayer(item.player_id, item.provider)"
          @menu="(evt) => onMenu(evt, item)"
        >
          <template #prepend>
            <ProviderIcon
              :domain="
                api.getProviderManifest(item.provider)?.domain || item.provider
              "
              :size="40"
              class="mr-4"
            />
          </template>

          <template #title>
            <div class="font-weight-medium">
              {{ getPlayerName(item) }}
            </div>
          </template>

          <template #subtitle>
            <div class="d-flex align-center gap-2 mt-1">
              <span class="text-medium-emphasis text-caption">
                {{
                  api.getProviderManifest(item.provider)?.name || item.provider
                }}
              </span>
              <v-chip
                v-if="
                  api.players[item.player_id]?.type &&
                  api.players[item.player_id]?.type !== PlayerType.PLAYER
                "
                size="x-small"
                variant="tonal"
                label
              >
                {{ $t(`player_type.${api.players[item.player_id]?.type}`) }}
              </v-chip>
            </div>
          </template>

          <template #append>
            <div class="d-flex align-center gap-2">
              <v-icon
                v-if="!item.enabled"
                icon="mdi-cancel"
                size="20"
                color="grey"
                :title="$t('settings.player_disabled')"
              />
              <v-icon
                v-else-if="!api.players[item.player_id]?.available"
                icon="mdi-timer-sand"
                size="20"
                color="grey"
                :title="$t('settings.player_not_available')"
              />
              <v-icon
                v-if="api.players[item.player_id]?.type"
                :icon="getPlayerTypeIcon(api.players[item.player_id]?.type)"
                size="20"
                color="grey"
                :title="$t(`player_type.${api.players[item.player_id]?.type}`)"
              />
            </div>
          </template>
        </ListItem>
      </v-list>
    </v-container>
    <AddPlayerGroupDialog v-model:show="showAddPlayerGroupDialog" />
  </div>
</template>

<script setup lang="ts">
import ListItem from "@/components/ListItem.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
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
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AddPlayerGroupDialog from "./AddPlayerGroupDialog.vue";

// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
const searchQuery = ref<string>("");
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
  playerConfigs.value = (await api.getPlayerConfigs())
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
    return (
      player.player_id.startsWith(SYNCGROUP_PREFIX) ||
      api
        .getProvider(player.provider)
        ?.supported_features.includes(ProviderFeature.REMOVE_GROUP_PLAYER)
    );
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

const getPlayerTypeIcon = function (playerType?: PlayerType) {
  const iconMap = {
    [PlayerType.PLAYER]: "mdi-speaker",
    [PlayerType.GROUP]: "mdi-speaker-multiple",
    [PlayerType.STEREO_PAIR]: "mdi-speaker-wireless",
  };
  return iconMap[playerType || PlayerType.PLAYER] || "mdi-speaker";
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
.player-disabled {
  opacity: 0.6;
}

.player-unavailable {
  opacity: 0.7;
}

.gap-2 {
  gap: 8px;
}
</style>
