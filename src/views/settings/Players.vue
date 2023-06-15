<template>
  <v-container>
    <v-card>
    <v-list>
      <v-list-item class="list-item-main"
        link
        @click="editPlayer(item.player_id)"
        v-hold="
          () => {
            editPlayer(item.player_id);
          }
        "
        v-for="item in playerConfigs.sort((a, b) => getPlayerName(a).localeCompare(getPlayerName(b)))"
        :key="item.player_id"
      >
        <template #prepend>
          <provider-icon :domain="item.provider" :size="'40px'" class="listitem-media-thumb" style="margin-left: 10px" />
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
          <div class="list-actions">
            <!-- player disabled -->
            <div v-if="!item.enabled">
              <v-tooltip location="bottom">
                <template #activator="{ props }">
                  <v-btn class="buttonicon" variant="plain" :ripple="false" :icon="true" v-bind="props">
                    <v-icon icon="mdi-cancel" />
                  </v-btn>
                </template>
                <span>{{ $t('settings.player_disabled') }}</span>
              </v-tooltip>
            </div>

            <!-- player not (yet) available -->
            <div v-else-if="!api.players[item.player_id]?.available">
              <v-tooltip location="bottom">
                <template #activator="{ props }">
                  <v-btn class="buttonicon" variant="plain" :ripple="false" :icon="true" v-bind="props">
                    <v-icon icon="mdi-timer-sand" />
                  </v-btn>
                </template>
                <span>{{ $t('settings.player_not_available') }}</span>
              </v-tooltip>
            </div>
          </div>

          <!-- contextmenu-->
          <v-menu location="bottom end">
            <template #activator="{ props }">
              <v-btn class="buttonicon" variant="plain" :ripple="false" :icon="true" v-bind="props">
                <v-icon icon="mdi-dots-vertical" />
              </v-btn>
            </template>

            <v-list>
              <v-list-item class="list-item-main"
                v-if="item.enabled && item.player_id in api.players"
                :title="$t('settings.configure')"
                prepend-icon="mdi-cog"
                @click="editPlayer(item.player_id)"
              />
              <v-list-item class="list-item-main"
                :title="item.enabled ? $t('settings.disable') : $t('settings.enable')"
                prepend-icon="mdi-cog"
                @click="toggleEnabled(item)"
              />
              <v-list-item class="list-item-main"
                v-if="api.providerManifests[item.provider].documentation"
                :title="$t('settings.documentation')"
                prepend-icon="mdi-bookshelf"
                :href="api.providerManifests[item.provider].documentation"
                target="_blank"
              />
              <v-list-item class="list-item-main"
                v-if="!api.players[item.player_id]?.available"
                :title="$t('settings.delete')"
                prepend-icon="mdi-delete"
                @click="removePlayerConfig(item.player_id)"
              />
            </v-list>
          </v-menu>
        </template>
      </v-list-item>
    </v-list>
  </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref, onBeforeUnmount, watch } from 'vue';
import { api } from '@/plugins/api';
import { EventType, PlayerConfig } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { useRouter } from 'vue-router';

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

<style>
.list-actions {
  display: inline-flex;
  width: auto;
  vertical-align: middle;
  align-items: center;
  padding: 0px;
}
</style>
