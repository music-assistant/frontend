<template>
  <div class="providers-header w-100">
    <ProviderFilters v-if="showSearch" @update:search="searchQuery = $event" />
    <!-- the empty state below carries the add button while there is nothing to list -->
    <Button
      v-if="!showMusicEmptyState"
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
    <ItemGroup v-if="viewMode === 'list'" class="gap-2">
      <Item
        v-for="item in getAllFilteredProviders()"
        :key="item.instance_id"
        variant="outline"
        role="button"
        tabindex="0"
        class="cursor-pointer"
        :class="{ 'opacity-60': !item.enabled }"
        data-testid="provider-row"
        @click="openProvider(item)"
        @keydown.enter.self.prevent="openProvider(item)"
        @keydown.space.self.prevent="openProvider(item)"
      >
        <ItemMedia>
          <ProviderIcon :domain="item.domain" :size="40" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="flex flex-wrap items-center gap-2">
            <span>{{ getProviderName(item) }}</span>
            <Badge
              v-if="statusVariant(item.status)"
              :variant="statusVariant(item.status)"
              data-testid="provider-status"
            >
              {{ statusLabel(item) }}
            </Badge>
            <Badge
              v-if="
                shouldShowStageBadge(api.providerManifests[item.domain]?.stage)
              "
              variant="outline"
              class="uppercase"
              data-testid="stage-badge"
            >
              {{ getStageLabel(api.providerManifests[item.domain]?.stage) }}
            </Badge>
          </ItemTitle>
          <ItemDescription
            v-if="isErrorStatus(item.status)"
            class="text-destructive"
          >
            {{ getErrorText(item) }}
          </ItemDescription>
          <ItemDescription v-else-if="api.providerManifests[item.domain]">
            {{ api.providerManifests[item.domain].description }}
          </ItemDescription>
          <ItemDescription
            v-if="canConfigureAccess(item)"
            data-testid="provider-access"
          >
            {{ accessSummary(item) }}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <span
            v-if="isProviderSyncing(item.instance_id)"
            :title="$t('settings.sync_running')"
          >
            <RefreshCw class="text-muted-foreground size-4 animate-spin" />
          </span>
          <Button
            v-if="isErrorStatus(item.status) && canReconfigure(item)"
            size="sm"
            variant="destructive"
            data-testid="provider-action"
            @click.stop="reconfigureProvider(item.instance_id)"
          >
            {{ $t("settings.reconfigure") }}
          </Button>
          <Button
            variant="ghost"
            size="icon-sm"
            data-testid="provider-menu"
            :aria-label="`${$t('more_options')}: ${getProviderName(item)}`"
            @click.stop="onMenu($event, item)"
          >
            <MoreVertical class="size-4" />
          </Button>
        </ItemActions>
      </Item>
    </ItemGroup>

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
          @click="openProvider(item)"
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
              v-if="isProviderSyncing(item.instance_id)"
              variant="text"
              size="small"
              icon
              :title="$t('settings.sync_running')"
            >
              <v-icon color="grey"> mdi-sync </v-icon>
            </v-btn>

            <!-- provider status (disabled / loading / error / etc) -->
            <v-btn
              v-if="statusIcon(item.status)"
              variant="text"
              size="small"
              icon
              :title="
                isErrorStatus(item.status)
                  ? getErrorText(item)
                  : statusLabel(item)
              "
            >
              <v-icon
                :icon="statusIcon(item.status)"
                :color="statusColor(item.status)"
              />
            </v-btn>

            <v-chip
              v-if="
                shouldShowStageBadge(api.providerManifests[item.domain]?.stage)
              "
              size="x-small"
              variant="flat"
              class="mx-1 text-uppercase"
              :color="getStageColor(api.providerManifests[item.domain]?.stage)"
            >
              {{ getStageLabel(api.providerManifests[item.domain]?.stage) }}
            </v-chip>

            <v-btn
              icon="mdi-dots-vertical"
              size="small"
              variant="text"
              :aria-label="`${$t('more_options')}: ${getProviderName(item)}`"
              :title="`${$t('more_options')}: ${getProviderName(item)}`"
              @click.stop="onMenu($event, item)"
            />
          </template>

          <v-card-title>
            {{ getProviderName(item) }}
          </v-card-title>

          <!-- Provider error warning for card view -->
          <v-card-text
            v-if="isErrorStatus(item.status)"
            class="provider-error-card py-2"
          >
            <div class="provider-error-inline">
              <v-icon
                :icon="statusIcon(item.status)"
                size="16"
                :color="statusColor(item.status)"
              />
              <span class="provider-error-text">{{ statusLabel(item) }}</span>
            </div>
            <div class="provider-error-detail mt-1">
              {{ getErrorText(item) }}
            </div>
            <v-btn
              v-if="canReconfigure(item)"
              size="small"
              color="error"
              variant="tonal"
              class="mt-2"
              block
              @click.stop="reconfigureProvider(item.instance_id)"
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

          <div
            v-if="canConfigureAccess(item)"
            class="provider-access-text px-4 pb-4"
            data-testid="provider-access"
          >
            {{ accessSummary(item) }}
          </div>
        </v-card>
      </v-col>
    </v-row>

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
        {{ $t("settings.music_sources_empty") }}
      </EmptyDescription>
      <EmptyContent>
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
  />
  <ProviderAccessDialog
    v-model:open="showAccessDialog"
    :config="accessDialogConfig"
    :users="managesAllSources ? users : null"
    @saved="loadItems"
  />
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderFilters from "@/components/ProviderFilters.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { useBackgroundTasks } from "@/composables/background-tasks/useBackgroundTasks";
import type { ContextMenuItem } from "@/helpers/context_menu_item";
import {
  effectiveProviderAccess,
  getProviderSharingTranslationKey,
  hasConfigurableAccess,
  isOwnMusicSource,
  userDisplayName,
} from "@/helpers/provider_access";
import {
  canReconfigureProvider,
  getProviderStageTranslationKey,
  getProviderStatusTranslationKey,
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
  type User,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Info, MoreVertical, Music, Plus, RefreshCw } from "@lucide/vue";
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
const managesAllSources = computed(() => authManager.isAdmin());

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
    .otherwise(() => $t("settings.add_provider"));
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
const { isProviderSyncing } = useBackgroundTasks();
let unsubProvidersUpdated: (() => void) | undefined;

const usersById = computed(
  () => new Map(users.value.map((user) => [user.user_id, user])),
);

// the providers of the current type (a member's own ones only), before the
// search narrows them down
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

  // ownership is enforced server-side as well; this keeps the page honest
  if (!managesAllSources.value) {
    listed = listed.filter((item) =>
      isOwnMusicSource(item, store.currentUser?.user_id),
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

// an empty music list invites a first source; any other empty list is the
// result of the active search or type filter
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

const removeProvider = function (providerInstanceId: string) {
  api
    .removeProviderConfig(providerInstanceId)
    .catch((err) => toast.error(String(err)));
  providerConfigs.value = providerConfigs.value.filter(
    (x) => x.instance_id != providerInstanceId,
  );
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
  return canReconfigureProvider(
    provider.status,
    api.providerManifests[provider.domain]?.has_setup_flow,
    provider.enabled,
  );
};

const getStageLabel = function (stage?: ProviderStage) {
  const key = getProviderStageTranslationKey(stage);
  return key ? $t(key) : "";
};

onMounted(() => {
  unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
    loadItems();
  });
  // listing the users is an admin call; a member only shares its own sources
  if (managesAllSources.value) loadUsers();
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
      label: "settings.delete",
      labelArgs: [],
      action: () => {
        removeProvider(item.instance_id);
      },
      icon: "mdi-delete",
      hide: providerManifest.builtin,
    },
    {
      label: "settings.reload_provider",
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
  // Try to get the name from the provider instance first
  const providerInstance = api.getProvider(config.instance_id);
  if (providerInstance && providerInstance.name) {
    return providerInstance.name;
  }
  // fallback on configured name or manifest name
  const manifest = api.providerManifests[config.domain];
  return config.name || config.default_name || manifest?.name;
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

// status indicator helpers: a loaded (healthy) provider shows no indicator
const statusIcon = function (status?: ProviderStatus | null) {
  return match(status)
    .with(ProviderStatus.DISABLED, () => "mdi-cancel")
    .with(ProviderStatus.LOADING, () => "mdi-timer-sand")
    .with(ProviderStatus.AUTH_REQUIRED, () => "mdi-key-alert")
    .with(ProviderStatus.INCOMPATIBLE, () => "mdi-alert-octagon-outline")
    .with(ProviderStatus.ERROR, () => "mdi-alert-circle")
    .otherwise(() => "");
};

const statusColor = function (status?: ProviderStatus | null) {
  return match(status)
    .with(
      ProviderStatus.AUTH_REQUIRED,
      ProviderStatus.INCOMPATIBLE,
      () => "warning",
    )
    .with(ProviderStatus.ERROR, () => "error")
    .otherwise(() => "grey");
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

// only a music source carries an owner and sharing
const canConfigureAccess = function (item: ProviderConfig) {
  return hasConfigurableAccess(item, api.providerManifests[item.domain]);
};

// the access record in its compact form: "<owner> · <who it is shared with>",
// without the owner for a member, which only ever sees its own sources
const accessSummary = function (item: ProviderConfig) {
  const access = effectiveProviderAccess(item.access);
  const sharedCount = access.shared_users.length;
  const sharing =
    access.sharing === ProviderSharing.SELECTED
      ? $t("settings.source_access.shared_with_count", sharedCount, {
          named: { count: sharedCount },
        })
      : $t(getProviderSharingTranslationKey(access.sharing));
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

.provider-card {
  transition:
    transform 0.2s ease,
    box-shadow 0.2s ease;
}

.provider-card:hover {
  transform: translateY(-2px);
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
}

.player-provider-card {
  cursor: pointer;
}

.provider-access-text {
  font-size: 12px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.4;
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
