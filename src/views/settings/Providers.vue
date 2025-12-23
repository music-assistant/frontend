<template>
  <!-- Onboarding welcome message -->
  <div v-if="store.isOnboarding" class="onboarding-card mx-5 mt-4">
    <div class="onboarding-header">
      <div>
        <h2 class="onboarding-title">{{ $t("settings.onboarding_title") }}</h2>
        <p class="onboarding-subtitle">
          {{ $t("settings.onboarding_subtitle") }}
        </p>
      </div>
      <v-btn
        icon="mdi-close"
        variant="text"
        size="small"
        class="onboarding-close"
        @click="dismissOnboarding"
      />
    </div>

    <div class="onboarding-sections">
      <div class="onboarding-section">
        <div class="section-icon music">
          <v-icon icon="mdi-music" size="24" />
        </div>
        <div class="section-content">
          <h3>{{ $t("settings.onboarding_music_title") }}</h3>
          <p>{{ $t("settings.onboarding_music_desc") }}</p>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          class="section-btn"
          @click="openAddProviderWithType('music')"
        >
          {{ $t("settings.onboarding_add_music") }}
        </v-btn>
      </div>

      <div class="onboarding-section">
        <div class="section-icon player">
          <v-icon icon="mdi-speaker" size="24" />
        </div>
        <div class="section-content">
          <h3>{{ $t("settings.onboarding_player_title") }}</h3>
          <p>{{ $t("settings.onboarding_player_desc") }}</p>
        </div>
        <v-btn
          color="primary"
          variant="flat"
          class="section-btn"
          @click="openAddProviderWithType('player')"
        >
          {{ $t("settings.onboarding_add_player") }}
        </v-btn>
      </div>
    </div>

    <p class="onboarding-footer">
      <v-icon icon="mdi-information-outline" size="16" class="mr-1" />
      {{ $t("settings.onboarding_footer") }}
    </p>
  </div>
  <div class="providers-header w-100">
    <ProviderFilters
      @update:search="searchQuery = $event"
      @update:types="selectedProviderTypes = $event"
    />
    <Button class="add-provider-btn" @click="showAddProviderDialog = true">
      <Plus class="size-4" />
      {{ $t("settings.add_provider") }}
    </Button>
  </div>

  <div class="pl-5 font-weight-medium">
    {{
      $t("settings.providers_total", [
        getAllFilteredProviders().length,
        getAllFilteredProviders().length > 1 ? "s" : "",
      ])
    }}
  </div>
  <Container :variant="viewMode === 'list' ? 'default' : 'panel'" class="mt-4">
    <v-list v-if="viewMode === 'list'" class="providers-list">
      <ListItem
        v-for="item in getAllFilteredProviders()"
        :key="item.instance_id"
        link
        :show-menu-btn="true"
        :class="{
          'provider-disabled': !item.enabled,
        }"
        @click="editProvider(item.instance_id)"
        @menu="(evt) => onMenu(evt, item)"
      >
        <template #prepend>
          <ProviderIcon
            :domain="item.domain"
            :size="40"
            class="provider-icon"
          />
        </template>

        <template #title>
          <div class="provider-name-title">
            {{ getProviderName(item) }}
          </div>
        </template>

        <template #subtitle>
          <div class="provider-meta">
            <!-- Provider error warning -->
            <div
              v-if="item.enabled && item.last_error"
              class="provider-error-inline"
            >
              <v-icon icon="mdi-alert-circle" size="16" color="error" />
              <span class="provider-error-text">{{
                $t("settings.provider_requires_attention")
              }}</span>
              <v-btn
                size="x-small"
                color="error"
                variant="tonal"
                class="ml-2"
                @click.stop="editProvider(item.instance_id)"
              >
                {{ $t("settings.reconfigure") }}
              </v-btn>
            </div>
            <span
              v-else-if="api.providerManifests[item.domain]"
              class="provider-description-text"
            >
              {{ api.providerManifests[item.domain].description }}
            </span>
            <span v-else class="provider-type-badge">
              {{ getProviderTypeTitle(item.type) }}
            </span>
          </div>
        </template>

        <template #append>
          <div class="provider-status-icons">
            <v-chip
              v-if="
                item.type === ProviderType.PLAYER && getPlayerCount(item) > 0
              "
              size="x-small"
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
            <v-icon
              v-if="
                api.syncTasks.value.filter(
                  (x) => x.provider_instance == item.instance_id,
                ).length > 0
              "
              icon="mdi-sync"
              size="20"
              color="grey"
              :title="$t('settings.sync_running')"
            />
            <v-icon
              v-if="!item.enabled"
              icon="mdi-cancel"
              size="20"
              color="grey"
              :title="$t('settings.provider_disabled')"
            />
            <v-icon
              v-else-if="item.last_error"
              icon="mdi-alert-circle"
              size="20"
              color="red"
              :title="item.last_error"
            />
            <v-icon
              v-else-if="!api.providers[item.instance_id]?.available"
              icon="mdi-timer-sand"
              size="20"
              color="grey"
              :title="$t('settings.not_loaded')"
            />
            <v-icon
              :icon="getProviderTypeIcon(item.type)"
              size="20"
              color="grey"
              :title="getProviderTypeTitle(item.type)"
            />
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
          </div>
        </template>
      </ListItem>
    </v-list>

    <v-row v-else>
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
              v-else-if="item.enabled && item.last_error"
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

          <!-- Provider error warning for card view -->
          <v-card-text
            v-if="item.enabled && item.last_error"
            class="provider-error-card py-2"
          >
            <div class="provider-error-inline">
              <v-icon icon="mdi-alert-circle" size="16" color="error" />
              <span class="provider-error-text">{{
                $t("settings.provider_requires_attention")
              }}</span>
            </div>
            <div class="provider-error-detail mt-1">
              {{ item.last_error }}
            </div>
            <v-btn
              size="small"
              color="error"
              variant="tonal"
              class="mt-2"
              block
              @click.stop="editProvider(item.instance_id)"
            >
              {{ $t("settings.reconfigure") }}
            </v-btn>
          </v-card-text>

          <v-card-text
            v-else-if="api.providerManifests[item.domain]"
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

    <div v-if="getAllFilteredProviders().length === 0" class="empty-state">
      <v-icon icon="mdi-puzzle-outline" size="64" class="empty-icon" />
      <div class="empty-title">{{ $t("no_content") }}</div>
      <div class="empty-message">
        {{ $t("no_content_filter") }}
      </div>
    </div>
  </Container>
  <AddProviderDialog
    v-model:show="showAddProviderDialog"
    :initial-type="addProviderInitialType"
  />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ListItem from "@/components/ListItem.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { isHiddenSendspinWebPlayer, openLinkInNewTab } from "@/helpers/utils";
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
import { Plus } from "lucide-vue-next";
import { match } from "ts-pattern";
import { computed, inject, onBeforeUnmount, ref, watch } from "vue";
import { useRouter } from "vue-router";
import AddProviderDialog from "./AddProviderDialog.vue";

// global refs
const router = useRouter();

const providersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("providersViewMode")!;

const viewMode = computed(() => providersViewMode.viewMode.value);

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref<string>("");
const selectedProviderTypes = ref<string[]>([]);
const showAddProviderDialog = ref<boolean>(false);
const addProviderInitialType = ref<string | undefined>(undefined);

const openAddProviderWithType = (type: string) => {
  addProviderInitialType.value = type;
  showAddProviderDialog.value = true;
};

watch(showAddProviderDialog, (isOpen) => {
  if (!isOpen) {
    addProviderInitialType.value = undefined;
  }
});
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
      query: { providers: providerInstance.instance_id },
    });
  }
};

const getPlayerCount = function (providerConfig: ProviderConfig): number {
  if (providerConfig.type !== ProviderType.PLAYER) return 0;
  const providerInstance = api.getProvider(providerConfig.instance_id);
  if (!providerInstance) return 0;

  return playerConfigs.value.filter((playerConfig) => {
    if (isHiddenSendspinWebPlayer(playerConfig)) return false;

    const playerProviderInstance = api.getProvider(playerConfig.provider);
    return (
      playerProviderInstance?.instance_id === providerInstance.instance_id ||
      playerConfig.provider === providerInstance.instance_id ||
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
          query: { providers: providerInstance.instance_id },
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
        router.push(`/settings/addgroup/${providerInstance.instance_id}`);
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

  // Sort: providers with errors first, then alphabetically
  return filtered.sort((a, b) => {
    const aHasError = a.enabled && a.last_error ? 1 : 0;
    const bHasError = b.enabled && b.last_error ? 1 : 0;
    if (aHasError !== bHasError) {
      return bHasError - aHasError; // Errors first
    }
    return getProviderName(a).localeCompare(getProviderName(b));
  });
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

.onboarding-card {
  background: linear-gradient(
    135deg,
    rgba(var(--v-theme-primary), 0.08) 0%,
    rgba(var(--v-theme-primary), 0.02) 100%
  );
  border: 1px solid rgba(var(--v-theme-primary), 0.2);
  border-radius: 16px;
  padding: 24px;
  position: relative;
}

.onboarding-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  margin-bottom: 16px;
}

.onboarding-icon {
  width: 56px;
  height: 56px;
  border-radius: 14px;
  background: rgba(var(--v-theme-primary), 0.12);
  display: flex;
  align-items: center;
  justify-content: center;
}

.onboarding-close {
  opacity: 0.6;
}

.onboarding-title {
  font-size: 24px;
  font-weight: 600;
  margin: 0 0 8px 0;
  color: rgb(var(--v-theme-on-surface));
}

.onboarding-subtitle {
  font-size: 15px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0 0 24px 0;
  line-height: 1.5;
}

.onboarding-sections {
  display: flex;
  flex-direction: column;
  gap: 16px;
  margin-bottom: 20px;
}

.onboarding-section {
  display: flex;
  align-items: center;
  gap: 16px;
  padding: 16px;
  background: rgba(var(--v-theme-surface), 0.6);
  border-radius: 12px;
  border: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}

.section-icon {
  width: 48px;
  height: 48px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.section-icon.music {
  background: linear-gradient(135deg, #1db954 0%, #1ed760 100%);
  color: white;
}

.section-icon.player {
  background: linear-gradient(135deg, #5c6bc0 0%, #7986cb 100%);
  color: white;
}

.section-content {
  flex: 1;
  min-width: 0;
}

.section-content h3 {
  font-size: 16px;
  font-weight: 600;
  margin: 0 0 4px 0;
  color: rgb(var(--v-theme-on-surface));
}

.section-content p {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  margin: 0;
  line-height: 1.4;
}

.section-btn {
  flex-shrink: 0;
}

.onboarding-footer {
  font-size: 13px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  margin: 0;
  display: flex;
  align-items: center;
}

@media (max-width: 768px) {
  .onboarding-card {
    padding: 20px;
  }

  .onboarding-section {
    flex-direction: column;
    text-align: center;
    gap: 12px;
  }

  .section-btn {
    width: 100%;
  }

  .onboarding-title {
    font-size: 20px;
  }
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

.providers-list {
  background: transparent;
}

.provider-name-title {
  font-weight: 500;
  font-size: 16px;
}

.provider-meta {
  display: flex;
  align-items: center;
  gap: 8px;
  margin-top: 4px;
  flex-wrap: wrap;
}

.provider-description-text {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.4;
}

.provider-type-badge {
  font-size: 11px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  text-transform: uppercase;
  letter-spacing: 0.5px;
  font-weight: 500;
}

.provider-status-icons {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: nowrap;
}

@media (max-width: 960px) {
  .provider-description-text {
    display: -webkit-box;
    -webkit-line-clamp: 1;
    line-clamp: 1;
    -webkit-box-orient: vertical;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .provider-status-icons {
    gap: 4px;
    min-width: 0;
  }

  .player-count-chip {
    flex-shrink: 1;
  }
}

.player-count-chip {
  cursor: pointer;
  transition: all 0.2s ease;
}

.player-count-chip:hover {
  transform: scale(1.05);
}

.provider-icon {
  margin-right: 12px;
}

.provider-disabled {
  opacity: 0.6;
}

.provider-error-inline {
  display: flex;
  align-items: center;
  gap: 6px;
  color: rgb(var(--v-theme-error));
}

.provider-error-text {
  font-size: 13px;
  font-weight: 500;
}

.provider-error-card {
  background: rgba(var(--v-theme-error), 0.08);
  border-radius: 8px;
  margin: 0 12px 12px 12px;
}

.provider-error-detail {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.7);
  line-height: 1.4;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  padding: 60px 20px;
  text-align: center;
  width: 100%;
}

.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}
</style>
