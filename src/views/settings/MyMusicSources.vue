<template>
  <Container variant="comfortable">
    <div class="mb-4 flex flex-wrap items-center justify-between gap-4">
      <p class="text-muted-foreground m-0 text-sm">
        {{ $t("settings.my_music_sources_description") }}
      </p>
      <!-- the empty state below carries the add button while there is nothing to list -->
      <Button
        v-if="ownSources.length"
        data-testid="add-source"
        @click="showAddDialog = true"
      >
        <Plus class="size-4" />
        {{ $t("settings.add_music_provider") }}
      </Button>
    </div>

    <ItemGroup v-if="ownSources.length" class="gap-2">
      <Item
        v-for="item in ownSources"
        :key="item.instance_id"
        variant="outline"
        data-testid="music-source"
      >
        <ItemMedia>
          <ProviderIcon :domain="item.domain" :size="40" />
        </ItemMedia>
        <ItemContent>
          <ItemTitle class="flex flex-wrap items-center gap-2">
            <span data-testid="source-name">{{ sourceName(item) }}</span>
            <Badge
              v-if="statusVariant(item.status)"
              :variant="statusVariant(item.status)"
              data-testid="source-status"
            >
              {{ statusLabel(item) }}
            </Badge>
          </ItemTitle>
          <ItemDescription v-if="item.last_error" class="text-destructive">
            {{ item.last_error.message }}
          </ItemDescription>
          <ItemDescription data-testid="source-sharing">
            {{ sharingLabel(item) }}
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <Button
            v-if="requiresReconfiguration(item)"
            size="sm"
            variant="destructive"
            data-testid="source-fix"
            @click="reconfigureSource(item.instance_id)"
          >
            {{ $t("settings.reconfigure") }}
          </Button>
          <DropdownMenu>
            <DropdownMenuTrigger as-child>
              <Button
                variant="ghost"
                size="icon-sm"
                data-testid="source-menu"
                :aria-label="`${$t('more_options')}: ${sourceName(item)}`"
              >
                <MoreVertical class="size-4" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem
                data-testid="source-options"
                @click="openOptions(item.instance_id)"
              >
                <Cog class="size-4" />
                {{ $t("settings.options") }}
              </DropdownMenuItem>
              <DropdownMenuItem
                v-if="canReconfigure(item)"
                data-testid="source-reconfigure"
                @click="reconfigureSource(item.instance_id)"
              >
                <RefreshCw class="size-4" />
                {{ $t("settings.reconfigure") }}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="source-share"
                @click="openSharing(item)"
              >
                <Share2 class="size-4" />
                {{ $t("settings.source_access.share_action") }}
              </DropdownMenuItem>
              <DropdownMenuItem
                data-testid="source-reload"
                @click="reloadSource(item.instance_id)"
              >
                <RotateCcw class="size-4" />
                {{ $t("settings.reload_provider") }}
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                variant="destructive"
                data-testid="source-remove"
                @click="removeSource(item.instance_id)"
              >
                <Trash2 class="size-4" />
                {{ $t("settings.remove_provider") }}
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </ItemActions>
      </Item>
    </ItemGroup>

    <Empty v-else-if="loaded" class="border" data-testid="music-sources-empty">
      <EmptyMedia variant="icon">
        <Music />
      </EmptyMedia>
      <EmptyTitle>{{ $t("settings.my_music_sources_empty_title") }}</EmptyTitle>
      <EmptyDescription>
        {{ $t("settings.my_music_sources_empty") }}
      </EmptyDescription>
      <EmptyContent>
        <Button data-testid="add-source-empty" @click="showAddDialog = true">
          <Plus class="size-4" />
          {{ $t("settings.add_music_provider") }}
        </Button>
      </EmptyContent>
    </Empty>

    <AddProviderDialog
      v-model:show="showAddDialog"
      :provider-type="ProviderType.MUSIC"
      multi-instance-only
    />
    <ProviderAccessDialog
      v-model:open="showAccessDialog"
      :config="accessDialogConfig"
      :users="null"
      @saved="loadItems"
    />
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import ProviderAccessDialog from "@/components/settings/providers/ProviderAccessDialog.vue";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import {
  effectiveProviderAccess,
  getProviderSharingTranslationKey,
  isOwnMusicSource,
} from "@/helpers/provider_access";
import {
  canReconfigureProvider,
  getProviderStatusTranslationKey,
  providerRequiresReconfiguration,
} from "@/helpers/provider_config";
import { api } from "@/plugins/api";
import {
  EventType,
  type ProviderConfig,
  ProviderSharing,
  ProviderStatus,
  ProviderType,
} from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  Cog,
  MoreVertical,
  Music,
  Plus,
  RefreshCw,
  RotateCcw,
  Share2,
  Trash2,
} from "@lucide/vue";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";
import AddProviderDialog from "./AddProviderDialog.vue";

// a source in one of these states can not serve music until the user acts on it
const ATTENTION_STATUSES = [
  ProviderStatus.AUTH_REQUIRED,
  ProviderStatus.ERROR,
  ProviderStatus.INCOMPATIBLE,
];

const router = useRouter();

const sources = ref<ProviderConfig[]>([]);
// the empty state waits for the first load, so it never flashes before the list
const loaded = ref(false);
const showAddDialog = ref(false);
const showAccessDialog = ref(false);
const accessDialogConfig = ref<ProviderConfig | null>(null);
let unsubProvidersUpdated: (() => void) | undefined;

const ownSources = computed(() =>
  [...sources.value].sort(
    (a, b) =>
      Number(needsAttention(b.status)) - Number(needsAttention(a.status)) ||
      sourceName(a).localeCompare(sourceName(b)),
  ),
);

const loadItems = async function () {
  // the configs are useless without the manifests, which can still be loading
  if (Object.keys(api.providerManifests).length === 0) return;
  try {
    const configs = await api.getProviderConfigs(ProviderType.MUSIC);
    sources.value = configs.filter((config) =>
      isOwnMusicSource(config, store.currentUser?.user_id),
    );
    loaded.value = true;
  } catch (err) {
    toast.error(String(err));
  }
};

const openOptions = function (instanceId: string) {
  router.push(`/settings/editprovider/${instanceId}`);
};

const reconfigureSource = function (instanceId: string) {
  eventbus.emit("setupFlowDialog", {
    kind: "reconfigure",
    instanceId,
    onFlowEnded: () => {
      void loadItems();
    },
  });
};

const openSharing = function (config: ProviderConfig) {
  accessDialogConfig.value = config;
  showAccessDialog.value = true;
};

const reloadSource = function (instanceId: string) {
  api
    .reloadProvider(instanceId)
    .then(() => toast.success($t("settings.provider_reloading")))
    .catch((err) => toast.error(String(err)));
};

const removeSource = function (instanceId: string) {
  eventbus.emit("deleteConfirmationDialog", {
    title: $t("settings.remove_provider"),
    message: $t("settings.remove_provider_confirm"),
    confirmLabel: $t("settings.remove_provider"),
    onConfirm: async () => {
      try {
        await api.removeProviderConfig(instanceId);
        toast.success($t("settings.provider_removed"));
        await loadItems();
      } catch (err) {
        toast.error(String(err));
      }
    },
  });
};

onMounted(() => {
  void loadItems();
  unsubProvidersUpdated = api.subscribe(EventType.PROVIDERS_UPDATED, () => {
    void loadItems();
  });
});

onBeforeUnmount(() => {
  unsubProvidersUpdated?.();
});

watch(
  () => Object.keys(api.providerManifests).length,
  (manifestCount) => {
    if (manifestCount > 0) void loadItems();
  },
);

// a disabled or failed source is not loaded, so its config names it
function sourceName(config: ProviderConfig) {
  return (
    api.providers[config.instance_id]?.name ||
    config.name ||
    config.default_name ||
    api.providerManifests[config.domain]?.name
  );
}

function statusLabel(config: ProviderConfig) {
  return $t(
    getProviderStatusTranslationKey(
      config.status,
      api.providerManifests[config.domain]?.stage,
    ),
  );
}

// a healthy source carries no badge, so only the states worth flagging map to one
function statusVariant(status?: ProviderStatus | null) {
  if (needsAttention(status)) return "destructive" as const;
  if (status === ProviderStatus.DISABLED || status === ProviderStatus.LOADING)
    return "secondary" as const;
  return undefined;
}

function sharingLabel(config: ProviderConfig) {
  const access = effectiveProviderAccess(config.access);
  if (access.sharing !== ProviderSharing.SELECTED)
    return $t(getProviderSharingTranslationKey(access.sharing));
  const count = access.shared_users.length;
  return $t("settings.source_access.shared_with_count", count, {
    named: { count },
  });
}

function canReconfigure(config: ProviderConfig) {
  return canReconfigureProvider(
    config.status,
    api.providerManifests[config.domain]?.has_setup_flow,
    config.enabled,
  );
}

function requiresReconfiguration(config: ProviderConfig) {
  return providerRequiresReconfiguration(
    config.status,
    api.providerManifests[config.domain]?.has_setup_flow,
    config.enabled,
  );
}

function needsAttention(status?: ProviderStatus | null) {
  return !!status && ATTENTION_STATUSES.includes(status);
}
</script>
