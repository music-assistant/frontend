<template>
  <div style="margin-bottom: 10px">
    <v-toolbar
      density="compact"
      class="titlebar"
      color="transparent"
      style="height: 55px"
    >
      <template #title> {{ $t("settings.players") }} </template>
      <template #append>
        <!-- ADD group player button/menu -->
        <v-menu v-if="providersWithGroupSupport.length > 0" scrim>
          <template #activator="{ props }">
            <v-btn v-bind="props" color="accent" variant="outlined">
              {{ $t("settings.add_group_player") }}
            </v-btn>
          </template>

          <v-card density="compact">
            <v-list-item
              v-for="provider in providersWithGroupSupport"
              :key="provider.domain"
              style="padding-top: 0; padding-bottom: 0; margin-bottom: 0"
              :title="provider.name"
              @click="addPlayerGroup(provider)"
            >
              <template #prepend>
                <provider-icon
                  :domain="provider.domain"
                  :size="26"
                  class="media-thumb"
                  style="margin-left: 10px"
                />
              </template>
            </v-list-item>
          </v-card>
        </v-menu>
      </template>
    </v-toolbar>
    <Container>
      <ListItem
        v-for="item in playerConfigs"
        :key="item.player_id"
        show-menu-btn
        link
        @menu="(evt: Event) => onMenu(evt, item)"
        @click="editPlayer(item.player_id, item.provider)"
      >
        <template #prepend>
          <provider-icon
            :domain="api.getProviderManifest(item!.provider)?.domain || ''"
            :size="40"
            class="listitem-media-thumb"
          />
        </template>

        <!-- title -->
        <template #title>
          <div class="line-clamp-1">{{ getPlayerName(item) }}</div>
        </template>

        <!-- subtitle -->
        <template #subtitle>
          <div class="line-clamp-1">
            {{ api.getProviderManifest(item!.provider)?.name || item.provider }}
          </div>
        </template>
        <!-- actions -->
        <template #append>
          <!-- player disabled -->
          <Button
            v-if="!item.enabled"
            icon
            :title="$t('settings.player_disabled')"
          >
            <v-icon icon="mdi-cancel" />
          </Button>

          <!-- player not (yet) available -->
          <Button
            v-else-if="!api.players[item.player_id]?.available"
            icon
            :title="$t('settings.player_not_available')"
          >
            <v-icon icon="mdi-timer-sand" />
          </Button>
        </template>
      </ListItem>
    </Container>
  </div>
</template>

<script setup lang="ts">
import Button from "@/components/Button.vue";
import Container from "@/components/mods/Container.vue";
import ListItem from "@/components/mods/ListItem.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { ContextMenuItem } from "@/layouts/default/ItemContextMenu.vue";
import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  PlayerType,
  ProviderFeature,
  ProviderInstance,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { computed, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
// listen for item updates to refresh items when that happens
const unsub = api.subscribe_multi([EventType.PLAYER_CONFIG_UPDATED], () => {
  loadItems();
});
onBeforeUnmount(unsub);

// computed properties
const providersWithGroupSupport = computed(() => {
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

// methods
const loadItems = async function () {
  playerConfigs.value = (await api.getPlayerConfigs())
    .filter((x) => x.provider != "builtin_player")
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

const addPlayerGroup = function (provider: ProviderInstance) {
  router.push(`/settings/addgroup/${provider.lookup_key}`);
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

// watchers
watch(
  () => api.players,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
</script>
