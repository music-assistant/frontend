<template>
  <div style="margin-bottom: 10px">
    <v-toolbar
      density="compact"
      class="titlebar"
      color="transparent"
      style="height: 55px"
    >
      <template #title> {{ $t('settings.players') }} </template>
      <template #append>
        <!-- ADD syncgroup player button -->
        <v-btn
          v-if="playersWithSyncFeature.length"
          color="accent"
          variant="outlined"
          @click="addSyncGroupPlayer"
        >
          {{ $t('settings.add_group_player') }}
        </v-btn>
      </template>
    </v-toolbar>
    <Container>
      <ListItem
        v-for="item in playerConfigs"
        :key="item.player_id"
        show-menu-btn
        link
        @menu="(evt: Event) => onMenu(evt, item)"
        @click="editPlayer(item.player_id)"
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
import { ref, onBeforeUnmount, watch, computed } from 'vue';
import { api } from '@/plugins/api';
import {
  EventType,
  PlayerConfig,
  ProviderFeature,
} from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { useRouter } from 'vue-router';
import Button from '@/components/mods/Button.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';
import { eventbus } from '@/plugins/eventbus';

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
const playersWithSyncFeature = computed(() => {
  // players that can be synced with other players
  return Object.values(api.players).filter(
    (x) =>
      x.available &&
      x.can_sync_with.length &&
      api
        .getProvider(x.provider)
        ?.supported_features.includes(ProviderFeature.SYNC_PLAYERS),
  );
});

// methods
const loadItems = async function () {
  playerConfigs.value = (await api.getPlayerConfigs()).sort((a, b) =>
    getPlayerName(a).localeCompare(getPlayerName(b)),
  );
};

const removePlayerConfig = function (playerId: string) {
  api.removePlayerConfig(playerId);
  playerConfigs.value = playerConfigs.value.filter(
    (x) => x.player_id != playerId,
  );
};

const editPlayer = function (playerId: string) {
  if (playerId in api.players) {
    // only allow edit if player is alive/available
    router.push(`/settings/editplayer/${playerId}`);
  }
};

const addSyncGroupPlayer = function (provider: string) {
  router.push('/settings/addsyncgroup');
};

const toggleEnabled = function (config: PlayerConfig) {
  config.enabled = !config.enabled;
  api.savePlayerConfig(config.player_id, { enabled: config.enabled });
};

const getPlayerName = function (playerConfig: PlayerConfig) {
  return (
    playerConfig.name ||
    api.players[playerConfig.player_id]?.display_name ||
    playerConfig.default_name ||
    playerConfig.player_id
  );
};

const openLinkInNewTab = function (url: string) {
  window.open(url, '_blank');
};

const onMenu = function (evt: Event, item: PlayerConfig) {
  const menuItems = [
    {
      label: 'settings.configure',
      labelArgs: [],
      action: () => {
        editPlayer(item.player_id);
      },
      icon: 'mdi-cog',
      disabled: !api.getProvider(item!.provider),
    },
    {
      label: item.enabled ? 'settings.disable' : 'settings.enable',
      labelArgs: [],
      action: () => {
        toggleEnabled(item);
      },
      icon: 'mdi-cancel',
      disabled: !api.getProvider(item!.provider),
    },
    {
      label: 'settings.documentation',
      labelArgs: [],
      action: () => {
        openLinkInNewTab(
          api.getProviderManifest(item!.provider)?.documentation || '',
        );
      },
      icon: 'mdi-bookshelf',
      disabled: !api.getProviderManifest(item!.provider)?.documentation,
    },
    {
      label: 'settings.delete',
      labelArgs: [],
      action: () => {
        removePlayerConfig(item.player_id);
      },
      icon: 'mdi-delete',
    },
  ];
  eventbus.emit('contextmenu', {
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
