<template>
  <div class="flex flex-col gap-6 p-6 pb-40">
    <section class="space-y-3" data-testid="storage-music-locations">
      <div class="flex flex-wrap items-center justify-between gap-2">
        <h2 class="text-muted-foreground text-sm font-medium">
          {{ $t("settings.storage.music_locations") }}
        </h2>
        <div class="flex flex-wrap items-center gap-2">
          <Button
            v-if="canAddShare"
            data-testid="storage-add-share"
            @click="openShareDialog(null)"
          >
            <Plus />
            {{ $t("settings.storage.add_network_share") }}
          </Button>
          <Button
            v-if="canAddFolder"
            variant="outline"
            data-testid="storage-add-folder"
            @click="showFolderDialog = true"
          >
            <FolderPlus />
            {{ $t("settings.storage.add_local_folder") }}
          </Button>
          <!-- the page refreshes itself once a running command is done -->
          <Button
            variant="ghost"
            size="icon-sm"
            :disabled="loading || !!pending"
            :aria-label="$t('refresh')"
            :title="$t('refresh')"
            data-testid="storage-refresh"
            @click="refresh"
          >
            <RefreshCw :class="{ 'animate-spin': loading }" />
          </Button>
        </div>
      </div>

      <div v-if="!info" class="flex min-h-24 items-center justify-center">
        <span v-if="failed" class="text-muted-foreground text-sm">
          {{ $t("settings.storage.load_failed") }}
        </span>
        <Spinner v-else class="size-8" />
      </div>
      <Empty
        v-else-if="mediaLocations.length === 0"
        class="border"
        data-testid="storage-empty"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HardDrive />
          </EmptyMedia>
          <EmptyTitle>
            {{ $t("settings.storage.music_locations_empty_title") }}
          </EmptyTitle>
          <EmptyDescription>
            {{ $t("settings.storage.music_locations_empty") }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <ItemGroup v-else class="gap-2">
        <StorageLocationRow
          v-for="location in mediaLocations"
          :key="location.path"
          :location="location"
          :shown-used-by="usedByShownOn(location, mediaLocations)"
          :can-use-as-source="canHoldNewSource(location)"
          :busy="!!pending || loading"
          :pending="pending?.path === location.path ? pending.action : null"
          @reload="reloadShare(location)"
          @edit="openShareDialog(location)"
          @remove="locationToRemove = location"
          @use-as-source="useAsSource(location)"
        />
      </ItemGroup>
    </section>

    <Alert v-if="showMountHint" variant="info" data-testid="storage-mount-hint">
      <Info />
      <!-- a Home Assistant app gets its network shares from Home Assistant -->
      <template v-if="runsAsHomeAssistantApp">
        <AlertTitle>
          {{ $t("settings.storage.cannot_mount_ha_title") }}
        </AlertTitle>
        <AlertDescription>
          <p>{{ $t("settings.storage.cannot_mount_ha_text") }}</p>
          <a
            :href="storageDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium underline underline-offset-4"
          >
            {{ $t("settings.storage.cannot_mount_link") }}
          </a>
        </AlertDescription>
      </template>
      <!-- only a server without a container can register a folder of its own -->
      <template v-else-if="canAddFolder">
        <AlertTitle>
          {{ $t("settings.storage.cannot_mount_host_title") }}
        </AlertTitle>
        <AlertDescription>
          {{
            $t("settings.storage.cannot_mount_host_text", {
              button: $t("settings.storage.add_local_folder"),
            })
          }}
        </AlertDescription>
      </template>
      <template v-else>
        <AlertTitle>
          {{ $t("settings.storage.cannot_mount_container_title") }}
        </AlertTitle>
        <AlertDescription>
          <p>{{ $t("settings.storage.cannot_mount_container_text") }}</p>
          <a
            :href="dockerDocsUrl"
            target="_blank"
            rel="noopener noreferrer"
            class="font-medium underline underline-offset-4"
          >
            {{ $t("settings.storage.cannot_mount_link") }}
          </a>
        </AlertDescription>
      </template>
    </Alert>

    <section
      v-if="serverLocations.length > 0"
      class="space-y-3"
      data-testid="storage-server"
    >
      <h2 class="text-muted-foreground text-sm font-medium">
        {{ $t("settings.storage.server_storage") }}
      </h2>
      <ItemGroup class="gap-2">
        <StorageLocationRow
          v-for="location in serverLocations"
          :key="location.path"
          :location="location"
        />
      </ItemGroup>
    </section>

    <NetworkShareDialog
      v-model:open="showShareDialog"
      :location="shareToEdit"
      :share-types="info?.supported_share_types ?? []"
      :share-versions="info?.supported_share_versions ?? {}"
      :added-action="offerUseAsSource"
      @saved="refresh"
    />
    <LocalFolderDialog v-model:open="showFolderDialog" @added="refresh" />
    <RemoveLocationDialog
      v-model:location="locationToRemove"
      @confirm="removeLocation"
    />
  </div>
</template>

<script setup lang="ts">
import LocalFolderDialog from "@/components/settings/storage/LocalFolderDialog.vue";
import NetworkShareDialog from "@/components/settings/storage/NetworkShareDialog.vue";
import RemoveLocationDialog from "@/components/settings/storage/RemoveLocationDialog.vue";
import StorageLocationRow from "@/components/settings/storage/StorageLocationRow.vue";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { ItemGroup } from "@/components/ui/item";
import { Spinner } from "@/components/ui/spinner";
import { useStorageInfo } from "@/composables/useStorageInfo";
import { LOCAL_FILES_DOMAIN } from "@/helpers/provider_domain";
import {
  canHoldNewSource,
  isManagedShare,
  type ManagedShareLocation,
  storageErrorText,
  usedByShownOn,
} from "@/helpers/storage";
import { getExternalLinkUrl } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { type StorageLocation, StorageUsage } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { FolderPlus, HardDrive, Info, Plus, RefreshCw } from "@lucide/vue";
import { computed, onMounted, ref } from "vue";
import { useI18n } from "vue-i18n";
import { toast } from "vue-sonner";

const DOCKER_DOCS_URL = "https://music-assistant.io/installation/#with-docker";
const STORAGE_DOCS_URL = "https://music-assistant.io/settings/storage/";

const { t } = useI18n();
const { info, loading, failed, mediaLocations, refresh } = useStorageInfo();

const showShareDialog = ref(false);
const showFolderDialog = ref(false);
const shareToEdit = ref<ManagedShareLocation | null>(null);
const locationToRemove = ref<StorageLocation | null>(null);
// the command running on a location; one runs at a time, and the actions of every row
// wait for it and for any refresh, so none is pressed on what the page showed before
const pending = ref<{ path: string; action: "reload" | "remove" } | null>(null);

const canAddShare = computed(
  () =>
    !!info.value?.can_mount_shares &&
    info.value.supported_share_types.length > 0,
);
const canAddFolder = computed(() => !!info.value?.can_add_local_folder);
const showMountHint = computed(
  () => !!info.value && !info.value.can_mount_shares,
);
const serverLocations = computed(
  () =>
    info.value?.locations.filter(
      (location) => location.usage !== StorageUsage.MEDIA,
    ) ?? [],
);
// the docs of a beta server live on the beta site
const dockerDocsUrl = computed(() => getExternalLinkUrl(DOCKER_DOCS_URL));
const storageDocsUrl = computed(() => getExternalLinkUrl(STORAGE_DOCS_URL));
const runsAsHomeAssistantApp = computed(
  () => !!api.serverInfo.value?.homeassistant_addon,
);

// a Local files source starts with the location's folder filled in; once it is set
// up, the location names it under "Used by" and no longer offers this
const useAsSource = (location: StorageLocation) => {
  eventbus.emit("setupFlowDialog", {
    kind: "provider",
    domain: LOCAL_FILES_DOMAIN,
    initialValues: { path: location.path },
    onFlowEnded: (finished) => {
      if (finished) void refresh();
    },
  });
};

// right after a network share is added, its toast offers to use it as a music source
const offerUseAsSource = (location: StorageLocation) =>
  canHoldNewSource(location)
    ? {
        label: t("settings.storage.use_as_source"),
        onClick: () => useAsSource(location),
      }
    : undefined;

const openShareDialog = (location: StorageLocation | null) => {
  shareToEdit.value = location && isManagedShare(location) ? location : null;
  showShareDialog.value = true;
};

const runCommand = async (
  location: StorageLocation,
  action: "reload" | "remove",
  command: () => Promise<unknown>,
  successKey: string,
  failureKey: string,
) => {
  if (pending.value) return;
  pending.value = { path: location.path, action };
  try {
    try {
      await command();
      toast.success(t(successKey));
    } catch (error) {
      toast.error(storageErrorText(error, t(failureKey)));
    }
    // the rows stay busy until they show what the command left behind; a failed
    // refresh reports itself and keeps what the page had
    await refresh();
  } finally {
    pending.value = null;
  }
};

const reloadShare = (location: StorageLocation) => {
  if (!isManagedShare(location)) return;
  void runCommand(
    location,
    "reload",
    () => api.reloadNetworkShare(location.share_name),
    "settings.storage.share_reloaded",
    "settings.storage.share_reload_failed",
  );
};

const removeLocation = (location: StorageLocation) => {
  if (isManagedShare(location)) {
    void runCommand(
      location,
      "remove",
      () => api.removeNetworkShare(location.share_name),
      "settings.storage.share_removed",
      "settings.storage.share_remove_failed",
    );
  } else {
    void runCommand(
      location,
      "remove",
      () => api.removeLocalFolder(location.path),
      "settings.storage.folder_removed",
      "settings.storage.folder_remove_failed",
    );
  }
};

onMounted(refresh);
</script>
