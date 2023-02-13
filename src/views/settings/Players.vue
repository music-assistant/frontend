<template>
  <section>
    <v-card-text>
      <!-- show alert if no players found -->
      <v-alert
        v-if="playerConfigs.length == 0"
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
      >
        <b>{{ $t("settings.no_providers") }}</b>
        <br />
        {{ $t("settings.no_providers_detail") }}
      </v-alert>
      <v-list lines="two" density="compact">
        <v-list-item
          v-for="config in playerConfigs"
          :key="config.player_id"
          :title="config.name || api.players[config.player_id].name"
          :subtitle="config.player_id"
          @click="editPlayer(config.player_id)"
        >
          <template v-slot:prepend>
            <v-img
              contain
              width="36px"
              class="listitem-thumb"
              :src="getProviderIcon(config.provider)"
            ></v-img>
          </template>

          <template v-slot:append>
            <div class="listitem-actions">
              <!-- player disabled -->
              <div class="listitem-action" v-if="!config.enabled">
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip" color="grey">mdi-cancel</v-icon>
                  </template>
                  <span>{{ $t("settings.provider_disabled") }}</span>
                </v-tooltip>
              </div>

              <!-- playerprovider has errors -->
              <div
                class="listitem-action"
                v-else-if="api.providers[config.provider]?.last_error"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip" color="red"
                      >mdi-alert-circle</v-icon
                    >
                  </template>
                  <span>{{ api.providers[config.provider]?.last_error }}</span>
                </v-tooltip>
              </div>

              <!-- player not (yet) available -->
              <div
                class="listitem-action"
                v-else-if="!api.players[config.player_id]?.available"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip">mdi-timer-sand</v-icon>
                  </template>
                  <span>{{ $t("settings.not_loaded") }}</span>
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
                      :title="$t('settings.configure')"
                      prepend-icon="mdi-cog"
                      @click="editPlayer(config.player_id)"
                    >
                    </v-list-item>
                    <v-list-item
                      v-if="providerManifests[config.provider].documentation"
                      :title="$t('settings.documentation')"
                      prepend-icon="mdi-bookshelf"
                      :href="providerManifests[config.provider].documentation"
                      target="_blank"
                    >
                    </v-list-item>
                    <v-list-item
                      v-if="!api.players[config.player_id]?.available"
                      :title="$t('settings.delete')"
                      prepend-icon="mdi-delete"
                      @click="deletePlayerConfig(config.player_id)"
                    >
                    </v-list-item>
                  </v-list>
                </v-menu>
              </div>
            </div>
          </template>
        </v-list-item>
      </v-list>

    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";

import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { getProviderIcon } from "@/components/ProviderIcons.vue";
import { onBeforeUnmount, watch } from "vue";
import { store } from "@/plugins/store";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const playerConfigs = ref<PlayerConfig[]>([]);
const providerManifests = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// computed properties

// listen for item updates to refresh items when that happens
const unsub = api.subscribe_multi([EventType.PLAYER_CONFIG_UPDATED], () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  playerConfigs.value = await api.getData("config/players");
  const manifests: ProviderManifest[] = await api.getData(
    "providers/available"
  );
  for (const prov of manifests) {
    providerManifests[prov.domain] = prov;
  }
};

const deletePlayerConfig = function (playerId: string) {
  api.sendCommand("config/players/remove", {
    player_id: playerId,
  });
  playerConfigs.value = playerConfigs.value.filter(
    (x) => x.player_id != playerId
  );
};

const editPlayer = function (playerId: string) {
  router.push(`/settings/editplayer/${playerId}`);
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

<style scoped>

</style>
