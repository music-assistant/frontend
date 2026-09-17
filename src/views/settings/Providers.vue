<template>
  <div class="providers-header w-100">
    <ProviderFilters v-if="showSearch" @update:search="searchQuery = $event" />
    <!-- the empty state below carries the add button while there is nothing to list -->
    <Button
      v-if="canOwnSources && !showMusicEmptyState"
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
      $t("settings.providers_total", getAllFilteredProviders().length, {
        named: { count: getAllFilteredProviders().length },
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
            :reconfigurable="canReconfigure(item)"
            :syncing="isProviderSyncing(item.instance_id)"
            :name="getProviderName(item)"
            :description="api.providerManifests[item.domain]?.description"
            :access-summary="
              canConfigureAccess(item) ? accessSummary(item) : null
            "
            :status-variant="statusVariant(item.status)"
            :status-label="statusLabel(item)"
            :is-error="isErrorStatus(item.status)"
            :error-text="getErrorText(item)"
            :stage-label="stageLabelFor(item)"
            @open="openProvider(item)"
            @menu="onMenu($event, item)"
            @reconfigure="reconfigureProvider(item.instance_id)"
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
            canOwnSources
              ? "settings.music_sources_empty"
              : "settings.music_sources_shared_empty",
          )
        }}
      </EmptyDescription>
      <EmptyContent v-if="canOwnSources">
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
      v-else-if="loaded && getAllFilteredProviders().length === 0"
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
    :provider-type="managesAllSources ? undefined : ProviderType.MUSIC"
    :multi-instance-only="!managesAllSources"
    :self-service-only="!managesAllSources"
  />
  <ProviderAccessDialog
    v-model:open="showAccessDialog"
    :config="accessDialogConfig"
    :users="managesAllSources ? users : null"
    :share-candidates="accessShareCandidates"
    :can-change-owner="managesAllSources"
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
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  effectiveProviderAccess,
  getProviderSharingTranslationKey,
  hasConfigurableAccess,
  isOwnMusicSource,
  isSelfServiceProvider,
  servesNobody,
  shareCandidates,
  userDisplayName,
} from "@/helpers/provider_access";
import {
  canReconfigureProvider,
  getProviderStageTranslationKey,
  getProviderStatusTranslationKey,
  isBuiltinProvider,
  providerDisplayName,
  providerRequiresReconfiguration,
  shouldShowStageBadge,
} from "@/helpers/provider_config";
import { openLinkInNewTab } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { requireServerVersion } from "@/plugins/api/helpers";
import {
  EventType,
  ProviderConfig,
  ProviderFeature,
  ProviderSharing,
  ProviderStage,
  ProviderStatus,
  ProviderType,
  Scope,
  type User,
  type UserSummary,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Info, Music, Plus } from "@lucide/vue";
import { match } from "ts-pattern";
import { computed, inject, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import AddProviderDialog from "./AddProviderDialog.vue";

// global refs
const router = useRouter();
const route = useRoute();

const providersViewMode = inject<{
  viewMode: { value: "list" | "card" };
  toggleViewMode: () => void;
}>("providersViewMode")!;

const viewMode = computed(() => providersViewMode.viewMode.value);

// a handful of providers is scanned faster than it is searched
const MIN_PROVIDERS_FOR_SEARCH = 10;

// an admin manages every source, a member only the music sources it owns
const managesAllSources = computed(() =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
);

// owning (and so adding) a music source takes the own-sources scope; a role
// without it only reads the sources it may use
const canOwnSources = computed(
  () =>
    managesAllSources.value || authManager.hasScope(Scope.CONFIG_PROVIDERS_OWN),
);

const currentType = computed(() =>
  managesAllSources.value
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

// local refs
const providerConfigs = ref<ProviderConfig[]>([]);
// the empty states wait for the first load, so they never flash before the list
const loaded = ref(false);
const searchQuery = ref<string>("");
const showAddProviderDialog = ref<boolean>(false);
const showAccessDialog = ref<boolean>(false);
const accessDialogConfig = ref<ProviderConfig | null>(null);
const users = ref<User[]>([]);
// the members a member may share its sources with, null until listed
const memberShareCandidates = ref<UserSummary[] | null>(null);
const { isProviderSyncing } = useBackgroundTasks();
let unsubProvidersUpdated: (() => void) | undefined;

const usersById = computed(
  () => new Map(users.value.map((user) => [user.user_id, user])),
);

// an admin picks the members to share with from its own user list
const accessShareCandidates = computed(() =>
  managesAllSources.value
    ? shareCandidates(users.value)
    : memberShareCandidates.value,
);

// the providers of the current type (the music sources for a member), before
// the search narrows them down
const listedProviders = computed(() => {
  let listed = providerConfigs.value;

  const typesQuery = currentType.value;
  if (typesQuery && typesQuery.trim().length > 0) {
    const types = typesQuery.split(",");
    listed = listed.filter((item) => types.includes(item.type));
  } else {
    // Default to showing only music providers when no types are specified
    listed = listed.filter((item) => item.type === ProviderType.MUSIC);
  }

  // a provider that ships with the server is not a source anyone chose, so a
  // member is not shown it among the sources it may use
  if (!managesAllSources.value) {
    listed = listed.filter(
      (item) => !isBuiltinProvider(api.providerManifests[item.domain]),
    );
  }
  return listed;
});

const showSearch = computed(
  () => listedProviders.value.length >= MIN_PROVIDERS_FOR_SEARCH,
);

// a search typed before the list shrank below the threshold would keep
// narrowing it down unseen
watch(showSearch, (shown) => {
  if (!shown) searchQuery.value = "";
});

// a member's own sources come first, then the ones shared with it; an admin
// gets a single untitled section with everything
const sections = computed(
  (): { key: string; label?: string; items: ProviderConfig[] }[] => {
    const listed = getAllFilteredProviders();
    const userId = store.currentUser?.user_id;
    const split = managesAllSources.value
      ? [{ key: "all", items: listed }]
      : [
          {
            key: "own",
            label: "settings.music_sources_own",
            items: listed.filter((item) => isOwnMusicSource(item, userId)),
          },
          {
            key: "shared",
            label: "settings.music_sources_shared",
            items: listed.filter((item) => !isOwnMusicSource(item, userId)),
          },
        ];
    return split.filter((section) => section.items.length > 0);
  },
);

// an empty music list invites a first source of one's own, or tells a viewer
// who cannot add any that nothing has been shared yet; any other empty list is
// the result of the active search or type filter
const showMusicEmptyState = computed(
  () =>
    loaded.value &&
    getAllFilteredProviders().length === 0 &&
    !searchQuery.value &&
    (currentType.value || ProviderType.MUSIC) === ProviderType.MUSIC,
);

const loadItems = async function () {
  // Only load provider configs if provider manifests are available
  // to avoid race conditions during initial connection
  if (Object.keys(api.providerManifests).length === 0) {
    console.debug(
      "Waiting for provider manifests to load before loading provider configs",
    );
    return;
  }
  try {
    // a member only ever lists music sources
    providerConfigs.value = await api.getProviderConfigs(
      managesAllSources.value ? undefined : ProviderType.MUSIC,
    );
    loaded.value = true;
  } catch (err) {
    toast.error(String(err));
  }
};

const loadUsers = async function () {
  try {
    users.value = await api.getAllUsers();
  } catch {
    toast.error($t("auth.users_load_failed"));
  }
};

const loadShareCandidates = async function () {
  try {
    memberShareCandidates.value = await api.getShareCandidates();
  } catch {
    toast.error($t("auth.users_load_failed"));
  }
};

const removeProvider = function (config: ProviderConfig) {
  const instanceId = config.instance_id;
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.remove_provider"),
    message: $t("settings.remove_provider_confirm", [getProviderName(config)]),
    confirmLabel: $t("settings.remove_provider"),
    onConfirm: async () => {
      try {
        await api.removeProviderConfig(instanceId);
        providerConfigs.value = providerConfigs.value.filter(
          (x) => x.instance_id != instanceId,
        );
      } catch (err) {
        toast.error(String(err));
      }
    },
  });
};

const openProviderOptions = function (providerInstanceId: string) {
  router.push(`/settings/editprovider/${providerInstanceId}`);
};

const openAccessDialog = function (config: ProviderConfig) {
  accessDialogConfig.value = config;
  showAccessDialog.value = true;
};

const reconfigureProvider = function (providerInstanceId: string) {
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId: providerInstanceId,
    onFlowEnded: () => {
      void loadItems();
    },
  });
};

const openProvider = function (provider: ProviderConfig) {
  if (
    maySetUp(provider) &&
    providerRequiresReconfiguration(
      provider.status,
      api.providerManifests[provider.domain]?.has_setup_flow,
      provider.enabled,
    )
  ) {
    reconfigureProvider(provider.instance_id);
    return;
  }
  openProviderOptions(provider.instance_id);
};

const canReconfigure = function (provider: ProviderConfig) {
  return (
    maySetUp(provider) &&
    canReconfigureProvider(
      provider.status,
      api.providerManifests[provider.domain]?.has_setup_flow,
      provider.enabled,
    )
  );
};

// reconfiguring a source sets it up again, which a member may only do for a
// source it owns of a provider it may set up itself
const maySetUp = function (provider: ProviderConfig) {
  return (
    canManageSource(provider) &&
    (managesAllSources.value ||
      isSelfServiceProvider(api.providerManifests[provider.domain]))
  );
};

// a member manages the sources it owns while its role may own sources; the
// ones shared with it are read-only
const canManageSource = function (provider: ProviderConfig) {
  return (
    managesAllSources.value ||
    (canOwnSources.value &&
      isOwnMusicSource(provider, store.currentUser?.user_id))
  );
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

onMounted(() => {
  unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
    loadItems();
  });
  // listing the users is an admin call, so a member picks from the share
  // candidates; the server lists them to whoever may own a source, older
  // servers not at all
  if (managesAllSources.value) loadUsers();
  else if (canOwnSources.value && api.supportsShareCandidates)
    loadShareCandidates();
});

onBeforeUnmount(() => {
  unsubProvidersUpdated?.();
});

const toggleEnabled = function (config: ProviderConfig) {
  config.enabled = !config.enabled;
  api
    .saveProviderConfig(
      config.domain,
      {
        enabled: config.enabled,
      },
      config.instance_id,
    )
    .catch((err) => toast.error(String(err)));
};

const reloadProvider = function (providerInstanceId: string) {
  api
    .reloadProvider(providerInstanceId)
    .catch((err) => toast.error(String(err)));
};

const onMenu = function (evt: Event, item: ProviderConfig) {
  const providerManifest = api.providerManifests[item.domain];
  // Guard against race condition where providerManifests aren't loaded yet
  if (!providerManifest) {
    console.warn("Provider manifest not yet loaded for:", item.domain);
    return;
  }
  const providerInstance = api.getProvider(item.instance_id);
  const menuItems: ContextMenuItem[] = [
    {
      label: "settings.options",
      labelArgs: [],
      action: () => {
        openProviderOptions(item.instance_id);
      },
      icon: "mdi-cog",
    },
    {
      // an admin sets owner and sharing, a member only shares its own source
      label: managesAllSources.value
        ? "settings.source_access.action"
        : "settings.source_access.share_action",
      labelArgs: [],
      action: () => {
        openAccessDialog(item);
      },
      icon: "mdi-account-key",
      hide: !canConfigureAccess(item),
    },
    {
      label: item.enabled ? "settings.disable" : "settings.enable",
      labelArgs: [],
      action: () => {
        toggleEnabled(item);
      },
      icon: "mdi-cancel",
      disabled: !providerManifest.allow_disable,
      hide: !managesAllSources.value,
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
      hide:
        !managesAllSources.value ||
        !providerInstance?.available ||
        item.type != ProviderType.MUSIC,
    },
    {
      label: "settings.remove_provider",
      labelArgs: [],
      action: () => {
        removeProvider(item);
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

  if (canReconfigure(item)) {
    menuItems.unshift({
      label: "settings.reconfigure",
      labelArgs: [],
      action: () => {
        reconfigureProvider(item.instance_id);
      },
      icon: "mdi-cog-refresh",
    });
  }

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
  return providerDisplayName(
    config,
    api.providers[config.instance_id],
    api.providerManifests[config.domain],
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

// an error status carries a (user-relevant) reason in last_error
const isErrorStatus = function (status?: ProviderStatus | null) {
  return (
    status === ProviderStatus.AUTH_REQUIRED ||
    status === ProviderStatus.INCOMPATIBLE ||
    status === ProviderStatus.ERROR
  );
};

const getErrorText = function (item: ProviderConfig) {
  // the server localizes last_error.message for the connection's locale
  return item.last_error?.message ?? "";
};

// only a music source carries an owner and sharing, and only whoever manages
// the source may change them
const canConfigureAccess = function (item: ProviderConfig) {
  return (
    canManageSource(item) &&
    hasConfigurableAccess(item, api.providerManifests[item.domain])
  );
};

// the access record in its compact form: "<owner> · <who it is shared with>",
// without the owner for a member, which only summarizes its own sources; a
// source nobody can use says so instead
const accessSummary = function (item: ProviderConfig) {
  const access = effectiveProviderAccess(item.access);
  if (servesNobody(access)) return $t("settings.source_access.nobody");
  const sharedCount = access.shared_users.length;
  const sharing =
    access.sharing === ProviderSharing.SELECTED
      ? $t("settings.source_access.shared_with_count", sharedCount, {
          named: { count: sharedCount },
        })
      : $t(
          getProviderSharingTranslationKey(
            access.sharing,
            isOwnMusicSource(item, store.currentUser?.user_id),
          ),
        );
  if (!managesAllSources.value) return sharing;
  const owner =
    access.owner === null
      ? $t("settings.source_access.household")
      : getUserName(access.owner);
  return `${owner} · ${sharing}`;
};

// a user that is no longer in the list is shown by its id
const getUserName = function (userId: string) {
  const user = usersById.value.get(userId);
  return user ? userDisplayName(user) : userId;
};

const getAllFilteredProviders = function () {
  let filtered = listedProviders.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    filtered = filtered.filter((item) => {
      const providerName = getProviderName(item).toLowerCase();
      return providerName.includes(query);
    });
  }

  // Sort: providers needing attention (error/auth/incompatible) first, then alphabetically
  return [...filtered].sort((a, b) => {
    const aHasError = isErrorStatus(a.status) ? 1 : 0;
    const bHasError = isErrorStatus(b.status) ? 1 : 0;
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
