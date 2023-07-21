<template>
  <Container>
    <ListItem
      v-for="item in playerConfigs"
      :key="item.player_id"
      v-hold="
        () => {
          editPlayer(item.player_id);
        }
      "
      link
      :context-menu-items="[
        {
          label: 'settings.configure',
          labelArgs: [],
          action: () => {
            editPlayer(item.player_id);
          },
          icon: 'mdi-cog',
        },
        {
          label: item.enabled ? 'settings.disable' : 'settings.enable',
          labelArgs: [],
          action: () => {
            toggleEnabled(item);
          },
          icon: 'mdi-cancel',
        },
        {
          label: 'settings.documentation',
          labelArgs: [],
          action: () => {
            openLinkInNewTab(api.providerManifests[item.provider].documentation!);
          },
          icon: 'mdi-bookshelf',
          disabled: !api.providerManifests[item.provider].documentation,
        },
        {
          label: 'settings.delete',
          labelArgs: [],
          action: () => {
            removePlayerConfig(item.player_id);
          },
          icon: 'mdi-delete',
        },
      ]"
      @click="editPlayer(item.player_id)"
    >
      <template #prepend>
        <provider-icon :domain="item.provider" :size="40" class="listitem-media-thumb" />
      </template>

      <!-- title -->
      <template #title>
        <div class="line-clamp-1">{{ getPlayerName(item) }}</div>
      </template>

      <!-- subtitle -->
      <template #subtitle
        ><div class="line-clamp-1">{{ api.providers[item.provider]?.name || item.provider }}</div>
      </template>
      <!-- actions -->
      <template #append>
        <!-- player disabled -->
        <Button v-if="!item.enabled" icon :title="$t('settings.player_disabled')">
          <v-icon icon="mdi-cancel" />
        </Button>

        <!-- player not (yet) available -->
        <Button v-else-if="!api.players[item.player_id]?.available" icon :title="$t('settings.player_not_available')">
          <v-icon icon="mdi-timer-sand" />
        </Button>
      </template>
    </ListItem>
  </Container>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue';
import { api } from '@/plugins/api';
import { EventType, PlayerConfig } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { useRouter } from 'vue-router';
import Button from '@/components/mods/Button.vue';
import ListItem from '@/components/mods/ListItem.vue';
import Container from '@/components/mods/Container.vue';

// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
// listen for item updates to refresh items when that happens
const unsub = api.subscribe_multi([EventType.PLAYER_CONFIG_UPDATED], () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  playerConfigs.value = await api.getPlayerConfigs();
};

const removePlayerConfig = function (playerId: string) {
  api.removePlayerConfig(playerId);
  playerConfigs.value = playerConfigs.value.filter((x) => x.player_id != playerId);
};

const editPlayer = function (playerId: string) {
  if (playerId in api.players) {
    // only allow edit if player is alive/available
    router.push(`/settings/editplayer/${playerId}`);
  }
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

// watchers
watch(
  () => api.players,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
</script>
