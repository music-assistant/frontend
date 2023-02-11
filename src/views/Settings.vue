<template>
  <section>
    <v-tabs
      v-model="activePanel"
      show-arrows
      centered
      grow
      stacked
      slider-color="primary"
    >
      <v-tab value="musicproviders">
        {{ $t("settings.musicproviders") }}
      </v-tab>
      <v-tab value="players">
        {{ $t("settings.players") }}
      </v-tab>
    </v-tabs>
    <v-divider />
    <v-card-text>
      <v-window v-model="activePanel">
        <v-window-item value="musicproviders">
          <v-list lines="two" density="compact">
            <v-list-item
              v-for="config in providerConfigs.filter(
                (x) => x.type == ProviderType.MUSIC && x.domain in availableProviders
              )"
              :key="config.instance_id"
              :title="availableProviders[config.domain].name"
              :subtitle="config.name || config.instance_id"
              @click="editProvider(config.instance_id)"
            >
              <template v-slot:prepend>
                <v-img
                  contain
                  width="36px"
                  class="listitem-thumb"
                  :src="getProviderIcon(config.domain)"
                ></v-img>
              </template>

              <template v-slot:append>
                <div class="listitem-actions">
                <!-- sync task running -->
                <div class="listitem-action">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <v-progress-circular
                        v-if="
                          api.syncTasks.value.filter(
                            (x) => x.provider_instance == config.instance_id
                          ).length > 0
                        "
                        indeterminate
                        v-bind="tooltip"
                        style="width: 80px"
                        color="primary"
                      />
                    </template>
                    <span>{{ $t("settings.sync_running") }}</span>
                  </v-tooltip>
                </div>

                <!-- warning -->
                <div class="listitem-action" v-if="!loadedProviders.includes(config.instance_id)">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <v-icon v-bind="tooltip" color="orange">mdi-shield-alert</v-icon>
                    </template>
                    <span>{{ $t("settings.sync_running") }}</span>
                  </v-tooltip>
                </div>

                <!-- contextmenu-->
                <div class="listitem-action">
                  <v-menu location="bottom end">
                    <template #activator="{ props }">
                      <v-btn
                        color="grey-lighten-1"
                        icon="mdi-cog-box"
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
                        @click="editProvider(config.instance_id)"
                        :disabled="
                          availableProviders[config.domain].config_entries
                            .length == 0
                        "
                      >
                      </v-list-item>
                      <v-list-item
                        v-if="availableProviders[config.domain].documentation"
                        :title="$t('settings.documentation')"
                        prepend-icon="mdi-cog"
                        :href="availableProviders[config.domain].documentation"
                        target="_blank"
                      >
                      </v-list-item>
                      <v-list-item
                        v-if="availableProviders[config.domain].documentation"
                        :title="$t('settings.sync')"
                        prepend-icon="mdi-cog"
                        @click="api.startSync(undefined, [config.instance_id])"
                      >
                      </v-list-item>
                      <v-list-item
                        v-if="
                          !availableProviders[config.domain].builtin &&
                          !availableProviders[config.domain].load_by_default
                        "
                        :title="$t('settings.delete')"
                        prepend-icon="mdi-cog"
                        @click="deleteProvider(config.instance_id)"
                      >
                      </v-list-item>
                    </v-list>
                  </v-menu>
                </div>
              </div>
              </template>
            </v-list-item>
          </v-list>
        </v-window-item>

        <v-window-item value="tplayerswo"> Two </v-window-item>
      </v-window>
    </v-card-text>
    <div>
      <v-alert
        v-if="!loading && api.providers.value.length < 5"
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
      >
        <b>{{ $t("settings.no_providers") }}</b>
        <br />
        {{ $t("settings.no_providers_detail") }}
      </v-alert>
      <div></div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import { api, ConnectionState } from "@/plugins/api";
import {
  EventMessage,
  EventType,
  PlayerConfig,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { getProviderIcon } from "@/components/ProviderIcons.vue";
import { computed, onBeforeUnmount, watchEffect } from "vue";
import { store } from "@/plugins/store";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const { t } = useI18n();
const router = useRouter();

// local refs
const activePanel = ref(0);
const loading = ref(true);
const playerConfigs = ref<PlayerConfig[]>([]);
const providerConfigs = ref<ProviderConfig[]>([]);
const availableProviders = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// computed properties
const loadedProviders = computed(() => {
  return api.providers.value.filter(x => x.available).map(x => x.instance_id)
});

store.topBarTitle = t("settings.settings");
store.topBarSubTitle = "";
store.topBarContextMenuItems = [];
onBeforeUnmount(() => {
  store.topBarContextMenuItems = [];
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe_multi(
  [
    EventType.PLAYER_CONFIG_UPDATED,
    EventType.PROVIDER_CONFIG_CREATED,
    EventType.PROVIDER_CONFIG_UPDATED,
    EventType.PROVIDER_LOADED,
  ],
  () => {
    loadItems();
  }
);
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  store.loading = true;
  providerConfigs.value = await api.getData("config/providers");
  playerConfigs.value = await api.getData("config/players");
  const manifests: ProviderManifest[] = await api.getData(
    "providers/available"
  );
  for (const prov of manifests) {
    availableProviders[prov.domain] = prov;
  }
  store.loading = false;
};

const deleteProvider = function (providerInstanceId: string) {
  api.sendCommand("config/providers/remove", {
    instance_id: providerInstanceId,
  });
  providerConfigs.value = providerConfigs.value.filter(
    (x) => x.instance_id != providerInstanceId
  );
};

const editProvider = function (providerInstanceId: string) {
  console.log("editProvider", providerInstanceId);
};

// watchers
watchEffect(() => {
  if (api.providers.value) {
    loadItems();
  }
});
</script>

<style scoped>

.listitem-action {
  align-items: right;
  width: 40px;
  display: flex;
}
.listitem-actions {
  align-items: right;
  width: 400px;
  height: 50px;
  display: flex;
  margin-right: -20px;
}
.listitem-thumb {
  padding-left: 0px;
  margin-right: 10px;
  margin-left: -15px;
  width: 50px;
  height: 50px;
}
</style>
