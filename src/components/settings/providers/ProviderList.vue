<template>
  <ProviderListPanel
    :list="list"
    :loaded="loaded"
    :view-mode="viewMode"
    :columns="columns"
    :title="title"
    @search="setSearchQuery"
    @filter-label="setLabelFilter"
    @add="openCatalog"
    @toggle-view-mode="providersViewMode.toggleViewMode()"
  >
    <template #row="{ item }">
      <ProviderRow
        :variant="viewMode"
        :columns="columns"
        :config="item"
        :manageable="canManageSource(item) && !isUnavailable(item)"
        :reconfigurable="canReconfigureSource(item)"
        :removable="canManageSource(item) && isUnavailable(item)"
        :syncing="isProviderSyncing(item.instance_id)"
        :name="getProviderName(item)"
        :description="api.providerManifests[item.domain]?.description"
        :labels="labelsOf(item)"
        :access-summary="
          canConfigureSourceAccess(item) ? accessSummary(item) : null
        "
        :status-variant="statusVariant(item.status)"
        :status-icon="statusIcon(item.status)"
        :status-label="statusLabel(item)"
        :is-error="isErrorStatus(item.status)"
        :error-text="getErrorText(item)"
        :community="isCommunityProvider(api.providerManifests[item.domain])"
        @open="openProvider(item)"
        @menu="openMenu($event, item)"
        @reconfigure="reconfigureProvider(item)"
        @remove="removeSource(item)"
      >
        <template v-if="$slots.details" #details>
          <slot name="details" :config="item" />
        </template>
      </ProviderRow>
    </template>
  </ProviderListPanel>

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
import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import ProviderListPanel from "@/components/settings/providers/ProviderListPanel.vue";
import ProviderRow, {
  type ProviderListColumns,
} from "@/components/settings/providers/ProviderRow.vue";
import { useBackgroundTasks } from "@/composables/background-tasks/useBackgroundTasks";
import { useProviderAccess } from "@/composables/settings/providers/useProviderAccess";
import { useProviderSources } from "@/composables/settings/providers/useProviderSources";
import { getEventPosition } from "@/composables/useHoldToOpenMenu";
import { getCatalogRoute } from "@/helpers/provider_catalog";
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
import { getProviderLabels, getShownLabels } from "@/helpers/provider_labels";
import { getProviderSettingsMenuItems } from "@/helpers/provider_settings_actions";
import { api } from "@/plugins/api";
import { type ProviderConfig, ProviderStatus } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { computed, inject } from "vue";
import { useRouter } from "vue-router";

/**
 * The list of providers on a settings page, kept in sync with the server, with
 * what can be done with each provider and the dialog for who may use a source.
 */
const props = defineProps<{
  // the list type, as providerListType gives it
  type: string;
  // in place of the name the Marketplace gives the type
  title?: string;
}>();

defineSlots<{
  // more about a provider, under its description
  details?(props: { config: ProviderConfig }): unknown;
}>();

const router = useRouter();

const providersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("providersViewMode")!;

const viewMode = computed(() => providersViewMode.viewMode.value);

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

// its manifest says what a provider offers
const labelsOf = function (config: ProviderConfig) {
  return getProviderLabels(api.providerManifests[config.domain]);
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

const {
  loaded,
  list,
  setSearchQuery,
  setLabelFilter,
  loadItems,
  removeSource,
} = useProviderSources({
  managesAllSources,
  listType: () => props.type,
  getProviderName,
  getLabels: labelsOf,
  isErrorStatus,
});

// a wide list only gives a column to what one of its providers has
const columns = computed((): ProviderListColumns => ({
  offers: list.value.filteredProviders.some(
    (item) => getShownLabels(labelsOf(item)).length > 0,
  ),
  access: list.value.filteredProviders.some(canConfigureSourceAccess),
}));

const {
  users,
  accessShareCandidates,
  accessDialogConfig,
  showAccessDialog,
  accessSummary,
  openAccessDialog,
} = useProviderAccess({ managesAllSources, canOwnSources });

// the Catalog opens on the type of the list and only offers what the viewer may add
const openCatalog = function () {
  void router.push(getCatalogRoute(props.type));
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
