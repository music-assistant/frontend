<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <SettingsHubHeader v-if="isHub" :name="listName" />
    <SettingsPageLinks :section="listName" />
    <CommunityMovedTypeNotice :types="listTypes" />

    <SettingsListPanel
      v-for="list in lists"
      :key="list.type"
      :title="listTitle(list.type)"
      :count="list.filteredProviders.length"
      :description="listDescription(list.type)"
      :view-mode="viewMode"
      :actions="listActions(list)"
      data-testid="provider-list"
      :data-list="list.type"
      @toggle-view-mode="providersViewMode.toggleViewMode()"
    >
      <template v-if="list.showSearch" #filters>
        <ProviderFilters @update:search="setSearchQuery(list.type, $event)" />
      </template>
      <div class="space-y-6">
        <section
          v-for="section in list.sections"
          :key="section.key"
          class="space-y-3"
          data-testid="provider-section"
          :data-section="section.key"
        >
          <h3
            v-if="section.label"
            class="text-muted-foreground m-0 text-sm font-medium"
          >
            {{ $t(section.label) }}
          </h3>
          <component
            :is="viewMode === 'list' ? ItemGroup : 'div'"
            :class="
              viewMode === 'list'
                ? 'gap-2'
                : 'grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-3'
            "
          >
            <ProviderRow
              v-for="item in section.items"
              :key="item.instance_id"
              :variant="viewMode"
              :config="item"
              :manageable="canManageSource(item) && !isUnavailable(item)"
              :reconfigurable="canReconfigureSource(item)"
              :removable="canManageSource(item) && isUnavailable(item)"
              :syncing="isProviderSyncing(item.instance_id)"
              :name="getProviderName(item)"
              :description="api.providerManifests[item.domain]?.description"
              :access-summary="
                canConfigureSourceAccess(item) ? accessSummary(item) : null
              "
              :status-variant="statusVariant(item.status)"
              :status-icon="statusIcon(item.status)"
              :status-label="statusLabel(item)"
              :is-error="isErrorStatus(item.status)"
              :error-text="getErrorText(item)"
              :community="
                isCommunityProvider(api.providerManifests[item.domain])
              "
              @open="openProvider(item)"
              @menu="openMenu($event, item)"
              @reconfigure="reconfigureProvider(item)"
              @remove="removeSource(item)"
            />
          </component>
        </section>
      </div>

      <Empty
        v-if="list.showMusicEmptyState"
        class="rounded-(--radius-xl) border"
        data-testid="music-sources-empty"
      >
        <EmptyMedia variant="icon">
          <Music />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.music_sources_empty_title") }}</EmptyTitle>
        <EmptyDescription>
          {{
            $t(
              canOwnSources()
                ? "settings.music_sources_empty"
                : "settings.music_sources_shared_empty",
            )
          }}
        </EmptyDescription>
        <EmptyContent v-if="canOwnSources()">
          <Button data-testid="add-provider-empty" @click="openCatalog(list)">
            <Plus class="size-4" />
            {{ $t("settings.add_music_provider") }}
          </Button>
        </EmptyContent>
      </Empty>

      <!-- the audio sources are a short list below the music sources, so an
           empty one says so in a line -->
      <p
        v-else-if="loaded && isEmptyAudioSources(list)"
        class="text-muted-foreground m-0 text-sm"
        data-testid="audio-sources-empty"
      >
        {{ $t("settings.audio_sources_empty") }}
      </p>

      <FilterEmptyState
        v-else-if="loaded && list.filteredProviders.length === 0"
        :icon="Puzzle"
        data-testid="providers-empty"
      />
    </SettingsListPanel>

    <ProviderAccessDialog
      v-model:open="showAccessDialog"
      :config="accessDialogConfig"
      :users="managesAllSources() ? users : null"
      :share-candidates="accessShareCandidates"
      :can-change-owner="managesAllSources()"
      @saved="loadItems"
    />
  </div>
</template>

<script setup lang="ts">
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import CommunityMovedTypeNotice from "@/components/settings/catalog/CommunityMovedTypeNotice.vue";
import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import ProviderRow from "@/components/settings/providers/ProviderRow.vue";
import SettingsHubHeader from "@/components/settings/SettingsHubHeader.vue";
import SettingsListPanel, {
  type SettingsPanelAction,
} from "@/components/settings/SettingsListPanel.vue";
import SettingsPageLinks from "@/components/settings/SettingsPageLinks.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { useBackgroundTasks } from "@/composables/background-tasks/useBackgroundTasks";
import { useProviderAccess } from "@/composables/settings/providers/useProviderAccess";
import {
  type ProviderList,
  useProviderSources,
} from "@/composables/settings/providers/useProviderSources";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import { getCatalogRoute, getCatalogType } from "@/helpers/provider_catalog";
import {
  getProviderStatusTranslationKey,
  isCommunityProvider,
  isProviderErrorStatus,
  providerDisplayName,
  providerRequiresReconfiguration,
} from "@/helpers/provider_config";
import {
  canConfigureSourceAccess,
  canManageSource,
  canOwnSources,
  canReconfigureSource,
  managesAllSources,
  maySetUpSource,
} from "@/helpers/provider_permissions";
import { getProviderSettingsMenuItems } from "@/helpers/provider_settings_actions";
import { AUDIO_SOURCES } from "@/helpers/settings_pages";
import {
  isSettingsHub,
  pageProviderLists,
  providerListName,
} from "@/helpers/settings_sections";
import { api } from "@/plugins/api";
import {
  type ProviderConfig,
  ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Music, Plus, Puzzle } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, inject, markRaw } from "vue";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();

const providersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("providersViewMode")!;

const viewMode = computed(() => providersViewMode.viewMode.value);

// the type the route names, the music sources by default
const currentType = computed(() =>
  managesAllSources()
    ? (route.query.types as string | undefined) || ProviderType.MUSIC
    : ProviderType.MUSIC,
);

// a member only lists its music sources
const listTypes = computed(() =>
  managesAllSources()
    ? pageProviderLists(currentType.value)
    : [ProviderType.MUSIC],
);

const listName = computed(() => providerListName(currentType.value));
const isHub = computed(() => isSettingsHub(listName.value));

const addProviderLabel = function (type: string) {
  return match(type)
    .with(ProviderType.MUSIC, () => $t("settings.add_music_provider"))
    .with(AUDIO_SOURCES, () => $t("settings.add_audio_source"))
    .with(ProviderType.PLAYER, () => $t("settings.add_player_provider"))
    .with(ProviderType.METADATA, () => $t("settings.add_metadata_provider"))
    .with(ProviderType.PLUGIN, () => $t("settings.add_plugin_provider"))
    .with(ProviderType.AUDIO_ANALYSIS, () =>
      $t("settings.add_audio_analysis_provider"),
    )
    .otherwise(() => $t("settings.add_new"));
};

// a list is titled by the name the Marketplace gives its type
const listTitle = function (type: string) {
  return $t(getCatalogType(type)?.label ?? type);
};

const listDescription = function (type: string) {
  return type === AUDIO_SOURCES
    ? $t("settings.audio_sources_description")
    : undefined;
};

// the empty state of the music sources carries the add button while there is
// nothing to list
const listActions = function (list: ProviderList): SettingsPanelAction[] {
  if (!canOwnSources() || list.showMusicEmptyState) return [];
  return [
    {
      key: "add-provider",
      label: addProviderLabel(list.type),
      shortLabel: $t("add"),
      icon: markRaw(Plus),
      onSelect: () => openCatalog(list),
    },
  ];
};

const isEmptyAudioSources = function (list: ProviderList) {
  return (
    list.type === AUDIO_SOURCES &&
    list.filteredProviders.length === 0 &&
    !list.searchQuery
  );
};

const { isProviderSyncing } = useBackgroundTasks();

const getProviderName = function (config: ProviderConfig) {
  return (
    providerDisplayName(
      config,
      api.providers[config.instance_id],
      api.providerManifests[config.domain],
    ) || config.instance_id
  );
};

// an error status carries a (user-relevant) reason in last_error
const isErrorStatus = isProviderErrorStatus;

// the provider of the entry is not on this server: it cannot be opened, only removed
const isUnavailable = function (config: ProviderConfig) {
  return config.status === ProviderStatus.UNAVAILABLE;
};

// only a status that needs attention carries a badge
const statusVariant = function (status?: ProviderStatus | null) {
  return isErrorStatus(status) ? ("destructive" as const) : undefined;
};

// the quiet states show as an icon by the name; a healthy provider shows neither
const statusIcon = function (status?: ProviderStatus | null) {
  if (status === ProviderStatus.LOADING) return "loading" as const;
  if (status === ProviderStatus.DISABLED) return "disabled" as const;
  return undefined;
};

const statusLabel = function (item: ProviderConfig) {
  return $t(
    getProviderStatusTranslationKey(
      item.status,
      api.providerManifests[item.domain]?.stage,
    ),
  );
};

const getErrorText = function (item: ProviderConfig) {
  // the server localizes last_error.message for the connection's locale
  return item.last_error?.message ?? "";
};

const { loaded, lists, setSearchQuery, loadItems, removeSource } =
  useProviderSources({
    managesAllSources,
    listTypes,
    getProviderName,
    isErrorStatus,
  });

const {
  users,
  accessShareCandidates,
  accessDialogConfig,
  showAccessDialog,
  accessSummary,
  openAccessDialog,
} = useProviderAccess({ managesAllSources, canOwnSources });

// the Catalog opens on the type of the list and only offers what the viewer may add
const openCatalog = function (list: ProviderList) {
  void router.push(getCatalogRoute(list.type));
};

const openProviderOptions = function (providerInstanceId: string) {
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const reconfigureProvider = function (provider: ProviderConfig) {
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId: provider.instance_id,
    name: getProviderName(provider),
    onFlowEnded: () => {
      void loadItems();
    },
  });
};

const openProvider = function (provider: ProviderConfig) {
  if (
    maySetUpSource(provider) &&
    providerRequiresReconfiguration(
      provider.status,
      api.providerManifests[provider.domain]?.has_setup_flow,
      provider.enabled,
    )
  ) {
    reconfigureProvider(provider);
    return;
  }
  openProviderOptions(provider.instance_id);
};

const toggleEnabled = function (config: ProviderConfig) {
  const enabled = !config.enabled;
  config.enabled = enabled;
  api
    .saveProviderConfig(config.domain, { enabled }, config.instance_id)
    .catch(() => {
      // the api already reports the failure; the server kept the previous
      // state, so the row has to show it again
      config.enabled = !enabled;
    });
};

const reloadProvider = function (providerInstanceId: string) {
  // the api reports a failing reload itself
  api.reloadProvider(providerInstanceId).catch(() => {});
};

const openMenu = function (evt: Event, item: ProviderConfig) {
  // Guard against race condition where providerManifests aren't loaded yet
  if (!api.providerManifests[item.domain]) {
    console.warn("Provider manifest not yet loaded for:", item.domain);
    return;
  }
  const { x, y } = getEventPosition(evt);
  eventbus.emit("contextmenu", {
    items: getProviderSettingsMenuItems(item, {
      includeSections: true,
      onAccess: openAccessDialog,
      onToggleEnabled: toggleEnabled,
      onReconfigure: reconfigureProvider,
      onReload: reloadProvider,
      onRemove: removeSource,
    }),
    posX: x,
    posY: y,
  });
};
</script>
