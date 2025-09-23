<template>
  <v-tabs v-model="tab" align-tabs="center">
    <v-tab :value="ProviderType.MUSIC">Music</v-tab>
    <v-tab :value="ProviderType.PLAYER">Player</v-tab>
    <v-tab :value="ProviderType.METADATA">Metadata</v-tab>
    <v-tab :value="ProviderType.PLUGIN">Plugin</v-tab>
  </v-tabs>

  <v-window v-model="tab">
    <v-window-item
      v-for="provType in ProviderType"
      :key="provType"
      :value="provType"
    >
      <div style="margin-bottom: 10px">
        <v-toolbar color="transparent" density="compact" class="titlebar">
          <template #title>
            {{ $t(`settings.${provType}providers`) }}
          </template>
          <template #append>
            <v-btn
              v-if="availableProviders.filter((x) => x.type == provType).length"
              color="primary"
              variant="outlined"
              @click="router.push(`/settings/addprovider?type=${provType}`)"
            >
              {{ $t("settings.add_new_provider_button", [provType]) }}
            </v-btn>
          </template>
        </v-toolbar>

        <!-- show alert if no music provider configured-->
        <v-alert
          v-if="
            provType == ProviderType.MUSIC &&
            providerConfigs.filter(
              (x) =>
                x.type == ProviderType.MUSIC &&
                x.domain in api.providerManifests &&
                x.domain !== 'builtin',
            ).length == 0
          "
          border="top"
          border-color="warning"
          style="margin: 20px"
          icon="mdi-alert-box-outline"
        >
          <b>{{ $t("settings.no_music_providers_detail") }}</b>
          <br />
          {{ $t("settings.no_music_providers_detail") }}
        </v-alert>

        <!-- show alert if no player provider configured-->
        <v-alert
          v-if="
            provType == ProviderType.PLAYER &&
            providerConfigs.filter(
              (x) =>
                x.type == ProviderType.PLAYER &&
                x.domain in api.providerManifests,
            ).length == 0
          "
          border="top"
          border-color="warning"
          style="margin: 20px"
          icon="mdi-alert-box-outline"
        >
          <b>{{ $t("settings.no_player_providers_detail") }}</b>
          <br />
          {{ $t("settings.no_player_providers_detail") }}
        </v-alert>

        <Container variant="comfortable" class="mt-4">
          <v-row>
            <v-col
              v-for="item in providerConfigs
                .filter((x) => x.type == provType)
                .sort((a, b) =>
                  getProviderName(a).localeCompare(getProviderName(b)),
                )"
              :key="item.instance_id"
              cols="12"
              sm="4"
              class="d-flex"
            >
              <v-card
                class="flex-fill rounded-lg"
                min-height="200px"
                @click="editProvider(item.instance_id)"
              >
                <template #prepend>
                  <provider-icon
                    :domain="item.domain"
                    :size="50"
                    class="listitem-media-thumb"
                    style="margin-top: 5px; margin-bottom: 5px"
                  />
                </template>

                <template #append>
                  <v-btn
                    v-if="
                      api.syncTasks.value.filter(
                        (x) => x.provider_instance == item.instance_id,
                      ).length > 0
                    "
                    variant="text"
                    size="small"
                    icon
                    :title="$t('settings.sync_running')"
                  >
                    <v-icon color="grey"> mdi-sync </v-icon>
                  </v-btn>

                  <!-- provider disabled -->
                  <v-btn
                    v-if="!item.enabled"
                    variant="text"
                    size="small"
                    icon
                    :title="$t('settings.provider_disabled')"
                  >
                    <v-icon color="grey"> mdi-cancel </v-icon>
                  </v-btn>

                  <!-- provider has errors -->
                  <v-btn
                    v-else-if="item.last_error"
                    variant="text"
                    size="small"
                    icon
                    :title="item.last_error"
                  >
                    <v-icon color="red"> mdi-alert-circle </v-icon>
                  </v-btn>

                  <!-- loading (provider not yet available) -->
                  <v-btn
                    v-else-if="!api.providers[item.instance_id]?.available"
                    variant="text"
                    size="small"
                    icon
                    :title="$t('settings.not_loaded')"
                  >
                    <v-icon icon="mdi-timer-sand" />
                  </v-btn>
                  <v-btn
                    icon="mdi-dots-vertical"
                    size="small"
                    variant="text"
                    @click.stop="onMenu($event, item)"
                  />
                </template>

                <v-card-title>
                  {{ getProviderName(item) }}
                </v-card-title>

                <v-card-text
                  class="provider-description"
                  :class="{
                    'truncated-text': isTextTruncated(
                      api.providerManifests[item.domain].description,
                    ),
                  }"
                >
                  {{ api.providerManifests[item.domain].description }}
                </v-card-text>
              </v-card>
            </v-col>
          </v-row>
        </Container>
      </div>
    </v-window-item>
  </v-window>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventType,
  ProviderConfig,
  ProviderFeature,
  ProviderManifest,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

// global refs
const router = useRouter();
const route = useRoute();

const tab = ref(ProviderType.MUSIC);

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
        // provider is either multi instance or does not exist at all
        x.multi_instance ||
        !providerConfigs.value.find((y) => y.domain == x.domain),
    )
    .sort((a, b) =>
      (a.name || api.providerManifests[a.domain].name).toUpperCase() >
      (b.name || api.providerManifests[b.domain].name).toUpperCase()
        ? 1
        : -1,
    );
});

// Initialize tab from URL parameter
onMounted(() => {
  const tabParam = route.query.tab;
  if (
    tabParam &&
    Object.values(ProviderType).includes(tabParam as ProviderType)
  ) {
    tab.value = tabParam as ProviderType;
  } else {
    // Default to MUSIC tab if no valid tab in URL
    tab.value = ProviderType.MUSIC;
  }
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
  providerConfigs.value = providerConfigs.value.filter(
    (x) => x.instance_id != providerInstanceId,
  );
};

const editProvider = function (providerInstanceId: string) {
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const addProvider = function (provider: ProviderManifest) {
  if (provider.depends_on) {
    if (!api.getProvider(provider.depends_on)) {
      // this provider depends on another provider that is not yet setup
      const depProvName = api.getProviderName(provider.depends_on);
      if (
        confirm(
          $t("settings.provider_depends_on_confirm", [
            provider.name,
            depProvName,
          ]),
        )
      ) {
        router.push(`/settings/addprovider/${provider.depends_on}`);
      }
      return;
    }
  }
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
    .sendCommand("config/providers/reload", {
      instance_id: providerInstanceId,
    })
    .catch((err) => alert(err));
};

const onMenu = function (evt: Event, item: ProviderConfig) {
  const providerManifest = api.providerManifests[item.domain];
  const providerInstance = api.getProvider(item.instance_id);
  const menuItems = [
    {
      label: "settings.configure",
      labelArgs: [],
      action: () => {
        editProvider(item.instance_id);
      },
      icon: "mdi-cog",
    },
    {
      label: item.enabled ? "settings.disable" : "settings.enable",
      labelArgs: [],
      action: () => {
        toggleEnabled(item);
      },
      icon: "mdi-cancel",
      disabled: !providerManifest.allow_disable,
    },
    {
      label: "settings.documentation",
      labelArgs: [],
      action: () => {
        openLinkInNewTab(providerManifest.documentation!);
      },
      icon: "mdi-bookshelf",
      disabled: !providerManifest.documentation,
    },
    {
      label: "settings.sync",
      labelArgs: [],
      action: () => {
        api.startSync(undefined, [item.instance_id]);
      },
      icon: "mdi-sync",
      hide: !providerInstance?.available || item.type != ProviderType.MUSIC,
    },
    {
      label: "settings.delete",
      labelArgs: [],
      action: () => {
        removeProvider(item.instance_id);
      },
      icon: "mdi-delete",
      hide: providerManifest.builtin,
    },
    {
      label: "settings.reload",
      labelArgs: [],
      action: () => {
        reloadProvider(item.instance_id);
      },
      icon: "mdi-refresh",
    },
  ];
  if (
    providerInstance?.available &&
    providerInstance.supported_features.includes(
      ProviderFeature.CREATE_GROUP_PLAYER,
    )
  ) {
    menuItems.push({
      label: "settings.add_group_player",
      labelArgs: [],
      action: () => {
        router.push(`/settings/addgroup/${providerInstance.lookup_key}`);
      },
      icon: "mdi-speaker-multiple",
    });
  }
  eventbus.emit("contextmenu", {
    items: menuItems,
    posX: (evt as PointerEvent).clientX,
    posY: (evt as PointerEvent).clientY,
  });
};

// watchers
watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);

// Watch tab changes and update URL
watch(tab, (newTab) => {
  if (newTab) {
    router.replace({
      query: { ...route.query, tab: newTab },
    });
  }
});

const getProviderName = function (config: ProviderConfig) {
  const providerBaseName = api.providerManifests[config.domain].name;
  if (config.name) {
    return `${providerBaseName} [${config.name}]`;
  }
  const providerInstance = api.getProvider(config.instance_id);
  if (providerInstance && providerInstance.instance_name_postfix) {
    return `${providerBaseName} [${providerInstance.instance_name_postfix}]`;
  }
  return providerBaseName;
};

const isTextTruncated = function (text: string) {
  return text && text.length > 150;
};
</script>

<style scoped>
.titlebar {
  padding: 25px 17px 0 0;
}
.titlebar.v-toolbar {
  height: 55px;
  font-family: "JetBrains Mono Medium";
}

.provider-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4em;
  max-height: 4.2em;
}
.provider-description.truncated-text {
  margin-bottom: 16px !important;
}
</style>
