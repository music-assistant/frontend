<template>
  <v-container style="padding-right:0">
    <v-list>
      <ListItem
        link
        @click="editPlayer(item.player_id)"
        v-hold="
          () => {
            editPlayer(item.player_id);
          }
        "
        v-for="item in playerConfigs.sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)))"
      >
        <template #prepend>
          <provider-icon :domain="item.provider" :size="'40px'" class="listitem-media-thumb" />
        </template>

        <!-- title -->
        <template #title>
          <div class="line-clamp-1">{{ getPlayerName(item) }}</div>
        </template>

        <!-- subtitle -->
        <template #subtitle
          ><div class="line-clamp-1">{{ api.providers[item.provider]?.name || item.provider }}</div>
        </template>
        <!-- append -->
        <template #append>
          <!-- player disabled -->
          <div v-if="!item.enabled">
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <ButtonIcon v-bind="props">
                  <v-icon icon="mdi-cancel" />
                </ButtonIcon>
              </template>
              <span>{{ $t('settings.player_disabled') }}</span>
            </v-tooltip>
          </div>

          <!-- player not (yet) available -->
          <div v-else-if="!api.players[item.player_id]?.available">
            <v-tooltip location="bottom">
              <template #activator="{ props }">
                <ButtonIcon v-bind="props">
                  <v-icon icon="mdi-timer-sand" />
                </ButtonIcon>
              </template>
              <span>{{ $t('settings.player_not_available') }}</span>
            </v-tooltip>
          </div>

          <!-- contextmenu-->
          <v-menu location="bottom end">
            <template #activator="{ props }">
              <ButtonIcon v-bind="props">
                <v-icon icon="mdi-dots-vertical" />
              </ButtonIcon>
            </template>

            <v-list>
              <ListItem
                v-if="item.enabled && item.player_id in api.players"
                :title="$t('settings.configure')"
                prepend-icon="mdi-cog"
                @click="editPlayer(item.player_id)"
              />
              <ListItem
                :title="item.enabled ? $t('settings.disable') : $t('settings.enable')"
                prepend-icon="mdi-cog"
                @click="toggleEnabled(item)"
              />
              <ListItem
                v-if="api.providerManifests[item.provider].documentation"
                :title="$t('settings.documentation')"
                prepend-icon="mdi-bookshelf"
                :href="api.providerManifests[item.provider].documentation"
                target="_blank"
              />
              <ListItem
                v-if="!api.players[item.player_id]?.available"
                :title="$t('settings.delete')"
                prepend-icon="mdi-delete"
                @click="removePlayerConfig(item.player_id)"
              />
            </v-list>
          </v-menu>
        </template>
      </ListItem>
    </v-list>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue';
import { api } from '@/plugins/api';
import { EventType, PlayerConfig } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { RecycleScroller } from 'vue-virtual-scroller';
import { useRouter } from 'vue-router';
import ButtonIcon from '@/components/ButtonIcon.vue';
import ListItem from '@/components/ListItem.vue';

// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
console.log(playerConfigs);
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

// watchers
watch(
  () => api.players,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);
</script>
