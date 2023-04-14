<template>
  <section>
    <v-card-text>
      <div>
        <v-list-item
          v-for="config in [...playerConfigs].sort((a, b) =>
            getPlayerName(a).toUpperCase() > getPlayerName(b).toUpperCase() ? 1 : -1
          )"
          :key="config.player_id"
          :title="getPlayerName(config)"
          :subtitle="api.providers[config.provider]?.name || config.provider"
          @click="editPlayer(config.player_id)"
        >
          <template #prepend>
            <provider-icon
              :domain="config.provider"
              :size="'40px'"
              class="listitem-thumb"
            />
          </template>

          <template #append>
            <div class="listitem-actions">
              <!-- player disabled -->
              <div
                v-if="!config.enabled"
                class="listitem-action"
              >
                <v-tooltip
                  location="top end"
                  origin="end center"
                >
                  <template #activator="{ props: tooltip }">
                    <v-icon
                      v-bind="tooltip"
                      color="grey"
                    >
                      mdi-cancel
                    </v-icon>
                  </template>
                  <span>{{ $t("settings.player_disabled") }}</span>
                </v-tooltip>
              </div>

              <!-- player not (yet) available -->
              <div
                v-else-if="!api.players[config.player_id]?.available"
                class="listitem-action"
              >
                <v-tooltip
                  location="top end"
                  origin="end center"
                >
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip">
                      mdi-timer-sand
                    </v-icon>
                  </template>
                  <span>{{ $t("settings.player_not_available") }}</span>
                </v-tooltip>
              </div>

              <!-- contextmenu-->
              <div class="listitem-action">
                <v-menu location="bottom end">
                  <template #activator="{ props }">
                    <v-btn
                      color="grey-darken-1"
                      icon="mdi-dots-vertical"
                      variant="text"
                      v-bind="props"
                      size="x-large"
                      style="margin-right: -70px"
                    />
                  </template>

                  <v-list>
                    <v-list-item
                      v-if="config.enabled && config.player_id in api.players"
                      :title="$t('settings.configure')"
                      prepend-icon="mdi-cog"
                      @click="editPlayer(config.player_id)"
                    />
                    <v-list-item
                      :title="config.enabled ? $t('settings.disable') : $t('settings.enable')"
                      prepend-icon="mdi-cog"
                      @click="toggleEnabled(config)"
                    />
                    <v-list-item
                      v-if="api.providerManifests[config.provider].documentation"
                      :title="$t('settings.documentation')"
                      prepend-icon="mdi-bookshelf"
                      :href="api.providerManifests[config.provider].documentation"
                      target="_blank"
                    />
                    <v-list-item
                      v-if="!api.players[config.player_id]?.available"
                      :title="$t('settings.delete')"
                      prepend-icon="mdi-delete"
                      @click="removePlayerConfig(config.player_id)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </div>
          </template>
        </v-list-item>
      </div>
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { ref } from "vue";

import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
} from "@/plugins/api/interfaces";
import ProviderIcon  from "@/components/ProviderIcon.vue";
import { onBeforeUnmount, watch } from "vue";

import { useRouter } from "vue-router";


// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);

// computed properties

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
  playerConfigs.value = playerConfigs.value.filter(
    (x) => x.player_id != playerId
  );
};

const editPlayer = function (playerId: string) {
  if (playerId in api.players) {
    // only allow edit if player is alive/available
    router.push(`/settings/editplayer/${playerId}`);
  }
};

const toggleEnabled = function (config: PlayerConfig) {
  config.enabled = !config.enabled;
  api.savePlayerConfig(config.player_id, {enabled: config.enabled })
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
  { immediate: true }
);
</script>

<style scoped></style>
