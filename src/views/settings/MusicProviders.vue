<template>
  <section>
    <v-card-text>
      <!-- show alert if no music providers configured-->
      <v-alert
        v-if="
          providerConfigs.filter(
            (x) =>
              x.type == ProviderType.MUSIC &&
              x.domain in providerManifests &&
              x.domain != 'url'
          ).length == 0
        "
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
      >
        <b>{{ $t("settings.no_providers") }}</b>
        <br>
        {{ $t("settings.no_providers_detail") }}
      </v-alert>
      <div>
        <v-list-item
          v-for="config in providerConfigs.filter(
            (x) =>
              x.type == ProviderType.MUSIC && x.domain in providerManifests
          )"
          :key="config.instance_id"
          :title="config.name || providerManifests[config.domain].name"
          :subtitle="providerManifests[config.domain].description"
          @click="editProvider(config.instance_id)"
        >
          <template #prepend>
            <v-img
              contain
              width="36px"
              class="listitem-thumb"
              :src="getProviderIcon(config.domain)"
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
                style="margin-right:15px;"
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
                      mdi-sync
                    </v-icon>
                  </template>
                  <span>{{ $t("settings.sync_running") }}</span>
                </v-tooltip>
              </div>

              <!-- provider disabled -->
              <div
                v-if="!config.enabled"
                class="listitem-action"
                style="margin-right:15px;"
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
                  <span>{{ $t("settings.provider_disabled") }}</span>
                </v-tooltip>
              </div>

              <!-- provider has errors -->
              <div
                v-else-if="api.providers[config.instance_id]?.last_error"
                class="listitem-action"
                style="margin-right:15px;"
              >
                <v-tooltip
                  location="top end"
                  origin="end center"
                >
                  <template #activator="{ props: tooltip }">
                    <v-icon
                      v-bind="tooltip"
                      color="red"
                    >
                      mdi-alert-circle
                    </v-icon>
                  </template>
                  <span>{{
                    api.providers[config.instance_id]?.last_error
                  }}</span>
                </v-tooltip>
              </div>

              <!-- loading (provider not yet available) -->
              <div
                v-else-if="!api.providers[config.instance_id]?.available"
                class="listitem-action"
                style="margin-right:15px;"
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
                  <span v-if="api.providers[config.instance_id]?.last_error">{{
                    api.providers[config.instance_id]?.last_error
                  }}</span>
                  <span v-else>{{ $t("settings.not_loaded") }}</span>
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
                      :disabled="
                        providerManifests[config.domain].config_entries
                          .length == 0
                      "
                      @click="editProvider(config.instance_id)"
                    />
                    <v-list-item
                      v-if="providerManifests[config.domain].documentation"
                      :title="$t('settings.documentation')"
                      prepend-icon="mdi-bookshelf"
                      :href="providerManifests[config.domain].documentation"
                      target="_blank"
                    />
                    <v-list-item
                      v-if="providerManifests[config.domain].documentation"
                      :title="$t('settings.sync')"
                      prepend-icon="mdi-sync"
                      @click="api.startSync(undefined, [config.instance_id])"
                    />
                    <v-list-item
                      v-if="
                        !providerManifests[config.domain].builtin &&
                          !providerManifests[config.domain].load_by_default
                      "
                      :title="$t('settings.delete')"
                      prepend-icon="mdi-delete"
                      @click="deleteProvider(config.instance_id)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </div>
          </template>
        </v-list-item>
      </div>

      <!-- float action button to add a new provider config-->
      <v-menu location="bottom end" min-width="500">
        <template #activator="{ props }">
          <v-btn
            color="primary"
            icon="mdi-plus"
            size="x-large"
            position="fixed"
            location="bottom right"
            elevation="8"
            style="margin-bottom: 180px; margin-right: 15px;z-index:9999"
            v-bind="props"
          />
        </template>

        <v-list>
          <v-list-item
            v-for="provider in availableMusicProviders"
            :key="provider.domain"
            :title="provider.name"
            @click="addProvider(provider)"
          >
            <template #prepend>
              <v-img
                contain
                width="26px"
                style="margin-right: 20px"
                :src="getProviderIcon(provider.domain)"
              />
            </template>
          </v-list-item>
        </v-list>
      </v-menu>
    </v-card-text>
  </section>
</template>

<script setup lang="ts">
import { reactive, ref } from "vue";
import "vue-virtual-scroller/dist/vue-virtual-scroller.css";

import { api } from "@/plugins/api";
import {
  EventType,
  ProviderConfig,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { getProviderIcon } from "@/components/ProviderIcons.vue";
import { computed, onBeforeUnmount, watch } from "vue";
import { store } from "@/plugins/store";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const providerManifests = reactive<{
  [provider_domain: string]: ProviderManifest;
}>({});

// computed properties
const availableMusicProviders = computed(() => {
  // music providers available for setup
  // filter out builtin providers
  // filter out providers that are already setup (and multi instance not allowed)
  return Object.values(providerManifests).filter(
    (x) =>
      !x.builtin &&
      (x.multi_instance || !providerConfigs.value.find((x) => x.domain))
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
    providerManifests[prov.domain] = prov;
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
  console.log("editProvider", providerInstanceId);
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const addProvider = function (provider: ProviderManifest) {
  console.log("addProvider", provider);
  router.push(`/settings/addprovider/${provider.domain}`);
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

<style scoped>

</style>
