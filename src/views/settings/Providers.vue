<template>
  <section>
    <v-card-text>
      <!-- show alert if no music providers configured-->
      <v-alert
        v-if="
          providerConfigs.filter(
            (x) =>
              x.type == ProviderType.MUSIC &&
              x.domain in api.providerManifests &&
              x.domain != 'url'
          ).length == 0
        "
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
        style="margin-bottom: 15px"
      >
        <b>{{ $t("settings.no_providers") }}</b>
        <br />
        {{ $t("settings.no_providers_detail") }}
      </v-alert>

      <!-- show section per providertpe -->
      <div v-for="provType in ProviderType">
        <v-toolbar
          :title="$t(`settings.${provType}providers`)"
          density="compact"
        />
        <v-list-item
          v-for="config in providerConfigs
            .filter(
              (x) => x.type == provType && x.domain in api.providerManifests
            )
            .sort((a, b) =>
              (a.name || api.providerManifests[a.domain].name).toUpperCase() >
              (b.name || api.providerManifests[b.domain].name).toUpperCase()
                ? 1
                : -1
            )"
          :key="config.instance_id"
          :title="config.name || api.providerManifests[config.domain].name"
          :subtitle="api.providerManifests[config.domain].description"
          @click="editProvider(config.instance_id)"
        >
          <template #prepend>
            <provider-icon
              :domain="config.domain"
              :size="'40px'"
              class="listitem-thumb"
            />
          </template>

          <template #append>
            <div class="listitem-actions">
              <!-- sync task running -->
              <div
                v-if="
                  api.syncTasks.value.filter(
                    (x) => x.provider_instance == config.instance_id
                  ).length > 0
                "
                class="listitem-action"
                style="margin-right: 15px"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip" color="grey"> mdi-sync </v-icon>
                  </template>
                  <span>{{ $t("settings.sync_running") }}</span>
                </v-tooltip>
              </div>

              <!-- provider disabled -->
              <div
                v-if="!config.enabled"
                class="listitem-action"
                style="margin-right: 15px"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip" color="grey"> mdi-cancel </v-icon>
                  </template>
                  <span>{{ $t("settings.provider_disabled") }}</span>
                </v-tooltip>
              </div>

              <!-- provider has errors -->
              <div
                v-else-if="config.last_error"
                class="listitem-action"
                style="margin-right: 15px"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip" color="red">
                      mdi-alert-circle
                    </v-icon>
                  </template>
                  <span>{{ config.last_error }}</span>
                </v-tooltip>
              </div>

              <!-- loading (provider not yet available) -->
              <div
                v-else-if="!api.providers[config.instance_id]?.available"
                class="listitem-action"
                style="margin-right: 15px"
              >
                <v-tooltip location="top end" origin="end center">
                  <template #activator="{ props: tooltip }">
                    <v-icon v-bind="tooltip"> mdi-timer-sand </v-icon>
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
                      @click="editProvider(config.instance_id)"
                    />
                    <v-list-item
                      :title="
                        config.enabled
                          ? $t('settings.disable')
                          : $t('settings.enable')
                      "
                      prepend-icon="mdi-cancel"
                      :disabled="api.providerManifests[config.domain].builtin"
                      @click="toggleEnabled(config)"
                    />
                    <v-list-item
                      v-if="api.providerManifests[config.domain].documentation"
                      :title="$t('settings.documentation')"
                      prepend-icon="mdi-bookshelf"
                      :href="api.providerManifests[config.domain].documentation"
                      target="_blank"
                    />
                    <v-list-item
                      v-if="
                        api.providers[config.instance_id]?.available &&
                        provType == ProviderType.MUSIC
                      "
                      :title="$t('settings.sync')"
                      prepend-icon="mdi-sync"
                      @click="api.startSync(undefined, [config.instance_id])"
                    />
                    <v-list-item
                      v-if="
                        !api.providerManifests[config.domain].builtin &&
                        !api.providerManifests[config.domain].load_by_default
                      "
                      :title="$t('settings.delete')"
                      prepend-icon="mdi-delete"
                      @click="deleteProvider(config.instance_id)"
                    />
                    <v-list-item
                      :title="$t('settings.reload')"
                      prepend-icon="mdi-refresh"
                      @click="reloadProvider(config.instance_id)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </div>
          </template>
        </v-list-item>
        <br />
      </div>

      <!-- float action button to add a new provider config-->
      <v-dialog :scrim="true">
        <template #activator="{ props }">
          <v-btn
            color="primary"
            icon="mdi-plus"
            size="x-large"
            position="fixed"
            location="bottom right"
            elevation="8"
            style="margin-bottom: 180px; margin-right: 15px; z-index: 9999"
            v-bind="props"
          />
        </template>

        <v-toolbar dark>
          <v-btn icon="mdi-play-circle-outline" />
          <v-toolbar-title style="padding-left: 10px">
            <b>{{ $t("settings.add_provider") }}</b>
          </v-toolbar-title>
        </v-toolbar>

        <v-list>
          <v-list-item
            v-for="provider in availableProviders"
            :key="provider.domain"
            :title="provider.name"
            @click="addProvider(provider)"
          >
            <template #prepend>
              <provider-icon
                :domain="provider.domain"
                :size="26"
                class="listitem-thumb"
                style="margin-left: 10px"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-dialog>
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import { api } from "@/plugins/api";
import {
  ConfigUpdate,
  EventType,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { computed, onBeforeUnmount, watch } from "vue";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);

// computed properties
const availableProviders = computed(() => {
  // providers available for setup
  // filter out builtin providers
  // filter out providers that are already setup (and multi instance not allowed)
  return Object.values(api.providerManifests)
    .filter(
      (x) =>
        !x.builtin &&
        (x.multi_instance || !providerConfigs.value.find((x) => x.domain))
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1
    );
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  providerConfigs.value = await api.getData("config/providers");
  const manifests: ProviderManifest[] = await api.getData(
    "providers/available"
  );
  for (const prov of manifests) {
    api.providerManifests[prov.domain] = prov;
  }
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
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const addProvider = function (provider: ProviderManifest) {
  router.push(`/settings/addprovider/${provider.domain}`);
};

const toggleEnabled = function (config: ProviderConfig) {
  const update: ConfigUpdate = {
    enabled: !config.enabled,
  };
  api.sendCommand("config/providers/update", {
    instance_id: config.instance_id,
    update,
  });
};

const reloadProvider = function (providerInstanceId: string) {
  api
    .getData("config/providers/reload", {
      instance_id: providerInstanceId,
    })
    .catch((err) => alert(err));
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true }
);
</script>

<style scoped></style>
