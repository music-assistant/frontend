<template>
  <div class="providers-header w-100">
    <ProviderFilters v-if="showSearch" @update:search="searchQuery = $event" />
    <!-- the empty state below carries the add button while there is nothing to list -->
    <Button
      v-if="canOwnSources() && !showMusicEmptyState"
      class="add-provider-btn"
      data-testid="add-provider"
      @click="showAddProviderDialog = true"
    >
      <Plus class="size-4" />
      {{ addProviderLabel }}
    </Button>
  </div>

  <div class="pl-5 font-weight-medium">
    {{
      $t("settings.providers_total", filteredProviders.length, {
        named: { count: filteredProviders.length },
      })
    }}
  </div>
  <Container
    :variant="viewMode === 'list' ? 'default' : 'panel'"
    class="mt-4 px-5"
  >
    <div class="space-y-6">
      <section
        v-for="section in sections"
        :key="section.key"
        class="space-y-3"
        data-testid="provider-section"
        :data-section="section.key"
      >
        <h2
          v-if="section.label"
          class="text-muted-foreground text-sm font-medium"
        >
          {{ $t(section.label) }}
        </h2>
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
            :manageable="canManageSource(item)"
            :reconfigurable="canReconfigureSource(item)"
            :syncing="isProviderSyncing(item.instance_id)"
            :name="getProviderName(item)"
            :description="api.providerManifests[item.domain]?.description"
            :access-summary="
              canConfigureSourceAccess(item) ? accessSummary(item) : null
            "
            :status-variant="statusVariant(item.status)"
            :status-label="statusLabel(item)"
            :is-error="isErrorStatus(item.status)"
            :error-text="getErrorText(item)"
            :stage-label="stageLabelFor(item)"
            @open="openProvider(item)"
            @menu="openMenu($event, item)"
            @reconfigure="reconfigureProvider(item)"
          />
        </component>
      </section>
    </div>

    <Empty
      v-if="showMusicEmptyState"
      class="border"
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
        <Button
          data-testid="add-provider-empty"
          @click="showAddProviderDialog = true"
        >
          <Plus class="size-4" />
          {{ $t("settings.add_music_provider") }}
        </Button>
      </EmptyContent>
    </Empty>

    <div
      v-else-if="loaded && filteredProviders.length === 0"
      class="empty-state"
    >
      <v-icon icon="mdi-puzzle-outline" size="64" class="empty-icon" />
      <div class="empty-title">{{ $t("no_content") }}</div>
      <div class="empty-message">
        {{ $t("no_content_filter") }}
      </div>
    </div>
  </Container>

  <!-- Audio analysis status hint -->
  <div
    v-if="showAudioAnalysisStatusHint"
    class="border-primary/20 bg-primary/5 mx-5 mt-4 flex flex-wrap items-center gap-4 rounded-xl border px-4 py-3"
  >
    <Info class="text-primary size-5 shrink-0" />
    <p class="text-muted-foreground m-0 flex-1 text-sm">
      {{ $t("settings.audio_analysis_status_hint") }}
    </p>
    <Button as-child variant="outline" size="sm">
      <RouterLink to="/settings/audio-analysis" class="no-underline">
        {{ $t("settings.audio_analysis_status_link") }}
      </RouterLink>
    </Button>
  </div>
  <AddProviderDialog
    v-model:show="showAddProviderDialog"
    :provider-type="managesAllSources() ? undefined : ProviderType.MUSIC"
    :multi-instance-only="!managesAllSources()"
    :self-service-only="!managesAllSources()"
  />
  <ProviderAccessDialog
    v-model:open="showAccessDialog"
    :config="accessDialogConfig"
    :users="managesAllSources() ? users : null"
    :share-candidates="accessShareCandidates"
    :can-change-owner="managesAllSources()"
    @saved="loadItems"
  />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import ProviderRow from "@/components/settings/providers/ProviderRow.vue";
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
import { useProviderSources } from "@/composables/settings/providers/useProviderSources";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import {
  getProviderStageTranslationKey,
  getProviderStatusTranslationKey,
  providerDisplayName,
  providerRequiresReconfiguration,
  shouldShowStageBadge,
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
import { api } from "@/plugins/api";
import { requireServerVersion } from "@/plugins/api/helpers";
import {
  type ProviderConfig,
  ProviderStage,
  ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Info, Music, Plus } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, inject, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import AddProviderDialog from "./AddProviderDialog.vue";

const router = useRouter();
const route = useRoute();

const providersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("providersViewMode")!;

const viewMode = computed(() => providersViewMode.viewMode.value);

const currentType = computed(() =>
  managesAllSources()
    ? (route.query.types as string | undefined)
    : ProviderType.MUSIC,
);

// the status page only exists on servers that ship audio analysis
const showAudioAnalysisStatusHint = computed(
  () =>
    currentType.value === ProviderType.AUDIO_ANALYSIS &&
    requireServerVersion("2.9.0"),
);

const addProviderLabel = computed(() => {
  const type = currentType.value;

  return match(type)
    .with(ProviderType.MUSIC, () => $t("settings.add_music_provider"))
    .with(ProviderType.PLAYER, () => $t("settings.add_player_provider"))
    .with(ProviderType.METADATA, () => $t("settings.add_metadata_provider"))
    .with(ProviderType.PLUGIN, () => $t("settings.add_plugin_provider"))
    .with(ProviderType.AUDIO_ANALYSIS, () =>
      $t("settings.add_audio_analysis_provider"),
    )
    .otherwise(() => $t("settings.add_new"));
});

const showAddProviderDialog = ref(false);
const { isProviderSyncing } = useBackgroundTasks();

const getProviderName = function (config: ProviderConfig) {
  return providerDisplayName(
    config,
    api.providers[config.instance_id],
    api.providerManifests[config.domain],
  );
};

// an error status carries a (user-relevant) reason in last_error
const isErrorStatus = function (status?: ProviderStatus | null) {
  return (
    status === ProviderStatus.AUTH_REQUIRED ||
    status === ProviderStatus.INCOMPATIBLE ||
    status === ProviderStatus.ERROR
  );
};

// a healthy provider carries no badge, so only the states worth flagging map to one
const statusVariant = function (status?: ProviderStatus | null) {
  if (isErrorStatus(status)) return "destructive" as const;
  if (status === ProviderStatus.DISABLED || status === ProviderStatus.LOADING)
    return "secondary" as const;
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

const getStageLabel = function (stage?: ProviderStage) {
  const key = getProviderStageTranslationKey(stage);
  return key ? $t(key) : "";
};

// a stage badge only shows for the stages worth flagging; a healthy stable
// provider carries none
const stageLabelFor = function (item: ProviderConfig) {
  const stage = api.providerManifests[item.domain]?.stage;
  return shouldShowStageBadge(stage) ? getStageLabel(stage) : "";
};

const {
  loaded,
  searchQuery,
  filteredProviders,
  sections,
  showSearch,
  showMusicEmptyState,
  loadItems,
  removeSource,
} = useProviderSources({
  managesAllSources,
  currentType,
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
  margin-left: auto;
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
