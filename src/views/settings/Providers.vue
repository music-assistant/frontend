<template>
  <v-container>
    <!-- show alert if no music providers configured-->
    <!-- show section per providertype -->
    <v-card v-for="provType in ProviderType" :key="provType" style="margin-bottom: 10px">
      <v-toolbar color="transparent" density="compact" class="titlebar">
        <template #title>
          <h2 class="line-clamp-1">{{ $t(`settings.${provType}providers`) }}</h2>
        </template>
        <template #append>
          <!-- ADD provider button + contextmenu -->
          <v-menu v-if="availableProviders.filter((x) => x.type == provType).length">
            <template #activator="{ props }">
              <v-btn variant="text" v-bind="props">
                {{ $t('settings.add_new') }}
              </v-btn>
            </template>

            <v-card density="compact">
              <ListItem
                v-for="provider in availableProviders.filter((x) => x.type == provType)"
                :key="provider.domain"
                density="compact"
                style="padding-top: 0; padding-bottom: 0; margin-bottom: 0"
                :title="provider.name"
                @click="addProvider(provider)"
              >
                <template #prepend>
                  <provider-icon :domain="provider.domain" :size="26" class="media-thumb" style="margin-left: 10px" />
                </template>
              </ListItem>
            </v-card>
          </v-menu>
        </template>
      </v-toolbar>
      <v-divider />

      <!-- alert if no providers configured -->
      <v-alert
        v-if="
          provType == ProviderType.MUSIC &&
          providerConfigs.filter(
            (x) =>
              x.type == ProviderType.MUSIC &&
              x.domain in api.providerManifests &&
              !api.providerManifests[x.domain].hidden,
          ).length == 0
        "
        color="primary"
        theme="dark"
        icon="mdi-radio-tower"
        prominent
        style="margin-bottom: 15px"
      >
        <b>{{ $t('settings.no_providers') }}</b>
        <br />
        {{ $t('settings.no_providers_detail') }}
      </v-alert>

      <v-container>
        <RecycleScroller
          v-slot="{ item }"
          :items="providerConfigs.filter((x) => x.type == provType)"
          :item-size="60"
          key-field="instance_id"
          page-mode
        >
          <ListItem
            link
            density="compact"
            @click="editProvider(item.instance_id)"
            v-hold="
              () => {
                editProvider(item.instance_id);
              }
            "
          >
            <template #prepend>
              <provider-icon :domain="item.domain" :size="'40px'" class="listitem-media-thumb" />
            </template>

            <!-- title -->
            <template #title>
              <div class="line-clamp-1">{{ item.name || api.providerManifests[item.domain].name }}</div>
            </template>

            <!-- subtitle -->
            <template #subtitle>
              <div class="line-clamp-1">{{ api.providerManifests[item.domain].description }}</div></template
            >
            <!-- append -->
            <template #append>
              <div>
                <!-- start -->
                <div v-if="api.syncTasks.value.filter((x) => x.provider_instance == item.instance_id).length > 0">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <ButtonIcon variant="icon" v-bind="tooltip">
                        <v-icon v-bind="tooltip" color="grey"> mdi-sync </v-icon>
                      </ButtonIcon>
                    </template>
                    <span>{{ $t('settings.sync_running') }}</span>
                  </v-tooltip>
                </div>

                <!-- provider disabled -->
                <div v-if="!item.enabled">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <ButtonIcon variant="icon" v-bind="tooltip">
                        <v-icon v-bind="tooltip" color="grey"> mdi-cancel </v-icon>
                      </ButtonIcon>
                    </template>
                    <span>{{ $t('settings.provider_disabled') }}</span>
                  </v-tooltip>
                </div>

                <!-- provider has errors -->
                <div v-else-if="item.last_error">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <ButtonIcon variant="icon" v-bind="tooltip">
                        <v-icon v-bind="tooltip" color="red"> mdi-alert-circle </v-icon>
                      </ButtonIcon>
                    </template>
                    <span>{{ item.last_error }}</span>
                  </v-tooltip>
                </div>

                <!-- loading (provider not yet available) -->
                <div v-else-if="!api.providers[item.instance_id]?.available">
                  <v-tooltip location="top end" origin="end center">
                    <template #activator="{ props: tooltip }">
                      <ButtonIcon variant="icon" v-bind="tooltip">
                        <v-icon icon="mdi-timer-sand" />
                      </ButtonIcon>
                    </template>
                    <span>{{ $t('settings.not_loaded') }}</span>
                  </v-tooltip>
                </div>
                <!-- end -->
                <!-- contextmenu-->
                <v-menu location="bottom end">
                  <template #activator="{ props }">
                    <ButtonIcon variant="icon" v-bind="props">
                      <v-icon icon="mdi-dots-vertical" />
                    </ButtonIcon>
                  </template>
                  <v-list>
                    <ListItem
                      :title="$t('settings.configure')"
                      prepend-icon="mdi-cog"
                      @click="editProvider(item.instance_id)"
                    />
                    <ListItem
                      :title="item.enabled ? $t('settings.disable') : $t('settings.enable')"
                      prepend-icon="mdi-cancel"
                      :disabled="api.providerManifests[item.domain].builtin"
                      @click="toggleEnabled(item)"
                    />
                    <ListItem
                      v-if="api.providerManifests[item.domain].documentation"
                      :title="$t('settings.documentation')"
                      prepend-icon="mdi-bookshelf"
                      :href="api.providerManifests[item.domain].documentation"
                      target="_blank"
                    />
                    <ListItem
                      v-if="api.providers[item.instance_id]?.available && provType == ProviderType.MUSIC"
                      :title="$t('settings.sync')"
                      prepend-icon="mdi-sync"
                      @click="api.startSync(undefined, [item.instance_id])"
                    />
                    <ListItem
                      v-if="
                        !api.providerManifests[item.domain].builtin &&
                        !api.providerManifests[item.domain].load_by_default
                      "
                      :title="$t('settings.delete')"
                      prepend-icon="mdi-delete"
                      @click="removeProvider(item.instance_id)"
                    />
                    <ListItem
                      :title="$t('settings.reload')"
                      prepend-icon="mdi-refresh"
                      @click="reloadProvider(item.instance_id)"
                    />
                  </v-list>
                </v-menu>
              </div>
            </template>
          </ListItem>
        </RecycleScroller>
      </v-container>
    </v-card>
  </v-container>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import 'vue-virtual-scroller/dist/vue-virtual-scroller.css';
import { RecycleScroller } from 'vue-virtual-scroller';
import { api } from '@/plugins/api';
import { EventType, ProviderConfig, ProviderManifest, ProviderType } from '@/plugins/api/interfaces';
import ProviderIcon from '@/components/ProviderIcon.vue';
import { computed, onBeforeUnmount, watch } from 'vue';
import { useRouter } from 'vue-router';
import ButtonIcon from '@/components/mods/ButtonIcon.vue';
import ListItem from '@/components/mods/ListItem.vue';

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);

// computed properties
const availableProviders = computed(() => {
  // providers available for setup
  // filter out hidden providers
  // filter out providers that are already setup (and multi instance not allowed)
  return Object.values(api.providerManifests)
    .filter(
      (x) =>
        !x.hidden &&
        // provider is either multi instance or does not exist at all
        (x.multi_instance || !providerConfigs.value.find((y) => y.domain == x.domain)),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
});

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  loadItems();
});
onBeforeUnmount(unsub);

// methods
const loadItems = async function () {
  providerConfigs.value = await api.getProviderConfigs();
};

const removeProvider = function (providerInstanceId: string) {
  api.removeProviderConfig(providerInstanceId);
  providerConfigs.value = providerConfigs.value.filter((x) => x.instance_id != providerInstanceId);
};

const editProvider = function (providerInstanceId: string) {
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const addProvider = function (provider: ProviderManifest) {
  router.push(`/settings/addprovider/${provider.domain}`);
};

const toggleEnabled = function (config: ProviderConfig) {
  config.enabled = !config.enabled;
  api.saveProviderConfig(
    config.domain,
    {
      enabled: config.enabled,
    },
    config.instance_id,
  );
};

const reloadProvider = function (providerInstanceId: string) {
  api
    .getData('config/providers/reload', {
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
  { immediate: true },
);
</script>

<style>
.titlebar {
  padding: 10px 0px;
}
</style>
