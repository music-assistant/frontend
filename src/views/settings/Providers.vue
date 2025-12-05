<template>
  <!-- Onboarding welcome message -->
  <v-alert
    v-if="store.isOnboarding"
    type="info"
    variant="tonal"
    closable
    class="mx-5 mt-4"
    @click:close="dismissOnboarding"
  >
    <v-alert-title class="text-h6 mb-2">
      {{ $t("settings.onboarding_title") }}
    </v-alert-title>
    <div class="text-body-1">
      <p class="mb-2">{{ $t("settings.onboarding_message") }}</p>
      <ul class="onboarding-list ml-4">
        <li>
          <v-icon icon="mdi-speaker" size="small" class="mr-2" />
          {{ $t("settings.onboarding_players") }}
        </li>
        <li>
          <v-icon icon="mdi-music" size="small" class="mr-2" />
          {{ $t("settings.onboarding_music") }}
        </li>
        <li>
          <v-icon icon="mdi-puzzle" size="small" class="mr-2" />
          {{ $t("settings.onboarding_plugins") }}
        </li>
      </ul>
    </div>
  </v-alert>
  <div class="providers-header w-100">
    <ProviderFilters
      @update:search="searchQuery = $event"
      @update:types="selectedProviderTypes = $event"
    />
    <v-btn
      color="primary"
      variant="outlined"
      height="40"
      class="add-provider-btn"
      @click="showAddProviderDialog = true"
    >
      {{ $t("settings.add_provider") }}
    </v-btn>
  </div>

  <div class="pl-5 font-weight-medium">
    {{
      $t("settings.providers_total", [
        getAllFilteredProviders().length,
        getAllFilteredProviders().length > 1 ? "s" : "",
      ])
    }}
  </div>
  <Container variant="comfortable" class="mt-4">
    <v-row>
      <v-col
        v-for="item in getAllFilteredProviders()"
        :key="item.instance_id"
        cols="12"
        md="6"
        lg="4"
        class="d-flex"
      >
        <v-card
          class="flex-fill rounded-lg provider-card d-flex flex-column"
          :class="{ 'player-provider-card': item.type === ProviderType.PLAYER }"
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
              variant="text"
              size="small"
              icon
              :title="getProviderTypeTitle(item.type)"
            >
              <v-icon :icon="getProviderTypeIcon(item.type)" />
            </v-btn>

            <v-chip
              v-if="api.providerManifests[item.domain]"
              size="x-small"
              variant="flat"
              class="mx-1 text-uppercase"
              :color="getStageColor(api.providerManifests[item.domain]?.stage)"
            >
              {{
                $t(
                  String(
                    api.providerManifests[item.domain]?.stage || "",
                  ).toLowerCase(),
                )
              }}
            </v-chip>

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
            v-if="api.providerManifests[item.domain]"
            class="provider-description flex-grow-1"
            :class="{
              'truncated-text': isTextTruncated(
                api.providerManifests[item.domain].description,
              ),
            }"
          >
            {{ api.providerManifests[item.domain].description }}
          </v-card-text>

          <!-- Player count badge for player providers -->
          <v-card-text
            v-if="item.type === ProviderType.PLAYER && getPlayerCount(item) > 0"
            class="provider-players-count mt-auto"
          >
            <v-chip
              size="small"
              variant="flat"
              color="primary"
              class="player-count-chip"
              @click.stop="viewPlayers(item.instance_id)"
            >
              <v-icon start size="small">mdi-speaker</v-icon>
              {{
                getPlayerCount(item) === 1
                  ? $t("settings.one_player")
                  : $t("settings.players_count", [
                      getPlayerCount(item),
                      getPlayerCount(item) !== 1 ? "s" : "",
                    ])
              }}
            </v-chip>
          </v-card-text>
        </v-card>
      </v-col>
    </v-row>
  </Container>
  <AddProviderDialog v-model:show="showAddProviderDialog" />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import {
  EventType,
  PlayerConfig,
  ProviderConfig,
  ProviderFeature,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { match } from "ts-pattern";
import { onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AddProviderDialog from "./AddProviderDialog.vue";

// global refs
const router = useRouter();

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref<string>("");
const selectedProviderTypes = ref<string[]>([]);
const showAddProviderDialog = ref<boolean>(false);
const playerConfigs = ref<PlayerConfig[]>([]);

// listen for item updates to refresh items when that happens
const unsub = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
  loadItems();
});
onBeforeUnmount(unsub);

const loadItems = async function () {
  // Only load provider configs if provider manifests are available
  // to avoid race conditions during initial connection
  if (Object.keys(api.providerManifests).length === 0) {
    console.debug(
      "Waiting for provider manifests to load before loading provider configs",
    );
    return;
  }
  providerConfigs.value = await api.getProviderConfigs();
  playerConfigs.value = await api.getPlayerConfigs();
};

const dismissOnboarding = function () {
  store.isOnboarding = false;
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

const viewPlayers = function (providerInstanceId: string) {
  const providerInstance = api.getProvider(providerInstanceId);
  if (providerInstance) {
    router.push({
      name: "playersettings",
      query: { providers: providerInstance.lookup_key },
    });
  }
};

const getPlayerCount = function (providerConfig: ProviderConfig): number {
  if (providerConfig.type !== ProviderType.PLAYER) return 0;
  const providerInstance = api.getProvider(providerConfig.instance_id);
  if (!providerInstance) return 0;

  return playerConfigs.value.filter((playerConfig) => {
    if (playerConfig.provider === "builtin_player") return false;
    const playerProviderInstance = api.getProvider(playerConfig.provider);
    return (
      playerProviderInstance?.lookup_key === providerInstance.lookup_key ||
      playerConfig.provider === providerInstance.lookup_key ||
      playerConfig.provider === providerInstance.domain
    );
  }).length;
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
  // Guard against race condition where providerManifests aren't loaded yet
  if (!providerManifest) {
    console.warn("Provider manifest not yet loaded for:", item.domain);
    return;
  }
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

  if (item.type === ProviderType.PLAYER && providerInstance) {
    menuItems.push({
      label: "settings.view_players",
      labelArgs: [],
      action: () => {
        router.push({
          name: "playersettings",
          query: { providers: providerInstance.lookup_key },
        });
      },
      icon: "mdi-speaker",
    });
  }
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

watch(
  () => api.players,
  () => {
    loadItems();
  },
);

// Watch for provider manifests to become available
watch(
  () => Object.keys(api.providerManifests).length,
  (manifestCount) => {
    if (manifestCount > 0) {
      loadItems();
    }
  },
);

const getProviderName = function (config: ProviderConfig) {
  // Try to get the name from the provider instance first
  const providerInstance = api.getProvider(config.instance_id);
  if (providerInstance && providerInstance.name) {
    return providerInstance.name;
  }
  // fallback on configured name or manifest name
  const manifest = api.providerManifests[config.domain];
  return config.name || manifest?.name;
};

const isTextTruncated = function (text: string) {
  return text && text.length > 150;
};

const getStageColor = function (stage?: string) {
  return match(stage)
    .with("stable", () => "green")
    .with("beta", () => "blue")
    .with("alpha", () => "purple")
    .with("experimental", () => "orange")
    .with("unmaintained", () => "grey")
    .with("deprecated", () => "red")
    .otherwise(() => "green");
};

const getProviderTypeTitle = function (type: ProviderType) {
  return match(type)
    .with(ProviderType.MUSIC, () => $t("settings.music"))
    .with(ProviderType.PLAYER, () => $t("settings.player"))
    .with(ProviderType.METADATA, () => $t("settings.metadata"))
    .with(ProviderType.PLUGIN, () => $t("settings.plugin"))
    .otherwise(() => $t("settings.player"));
};

const getProviderTypeIcon = function (type: ProviderType) {
  const iconMap = {
    [ProviderType.MUSIC]: "mdi-music",
    [ProviderType.PLAYER]: "mdi-speaker",
    [ProviderType.METADATA]: "mdi-file-code",
    [ProviderType.PLUGIN]: "mdi-puzzle",
  };
  return iconMap[type] || "mdi-help-circle";
};

const getAllFilteredProviders = function () {
  let filtered = [...providerConfigs.value];

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((item) => {
      const providerName = getProviderName(item).toLowerCase();
      return providerName.includes(query);
    });
  }

  if (selectedProviderTypes.value.length > 0) {
    filtered = filtered.filter((item) =>
      selectedProviderTypes.value.includes(item.type),
    );
  }

  return filtered.sort((a, b) =>
    getProviderName(a).localeCompare(getProviderName(b)),
  );
};
</script>

<style scoped>
.providers-header {
  display: flex;
  align-items: stretch;
  justify-content: space-between;
  gap: 16px;
  flex-wrap: wrap;
  padding: 20px 20px 6px 20px;
}

.add-provider-btn {
  flex-shrink: 0;
  align-self: center;
}

/* Mobile responsive */
@media (max-width: 960px) {
  .providers-header {
    flex-direction: column;
    align-items: stretch;
  }

  .add-provider-btn {
    width: 100%;
    align-self: stretch;
  }
}

.provider-description {
  display: -webkit-box;
  -webkit-line-clamp: 3;
  line-clamp: 3;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  line-height: 1.4em;
  max-height: 4.2em;
}
.provider-description.truncated-text {
  margin-bottom: 16px !important;
}

.onboarding-list {
  list-style: none;
  padding-left: 0;
}

.onboarding-list li {
  display: flex;
  align-items: center;
  margin-bottom: 8px;
}

.provider-card {
  transition: all 0.2s ease;
}

.provider-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.player-provider-card {
  cursor: pointer;
}

.provider-players-count {
  padding-top: 12px !important;
  padding-bottom: 12px !important;
  margin-top: auto;
  align-content: end;
}

.player-count-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.player-count-chip:hover {
  transform: scale(1.05);
}
</style>
