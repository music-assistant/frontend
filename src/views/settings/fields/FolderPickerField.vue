<script setup lang="ts">
import FolderPickerAddLocation from "@/components/settings/storage/FolderPickerAddLocation.vue";
import FolderPickerBrowser from "@/components/settings/storage/FolderPickerBrowser.vue";
import FolderPickerEmpty from "@/components/settings/storage/FolderPickerEmpty.vue";
import FolderPickerLocations from "@/components/settings/storage/FolderPickerLocations.vue";
import StoragePath from "@/components/settings/storage/StoragePath.vue";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { useStorageInfo } from "@/composables/useStorageInfo";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  findStoragePosition,
  joinStoragePath,
  sameStoragePath,
  storageErrorText,
  type StoragePosition,
} from "@/helpers/storage";
import { api } from "@/plugins/api";
import type {
  ConfigValueType,
  StorageLocation,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { FolderCheck, RefreshCw } from "@lucide/vue";
import { computed, onMounted, ref, useId } from "vue";
import { toast } from "vue-sonner";

/**
 * Picks a folder on one of the server's media locations: the folder that is open is
 * the one picked, and the entry value is its absolute path. There is deliberately no
 * way to type a path.
 */
const props = defineProps<{
  entry: ConfigEntryUI;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const labelId = useId();
const {
  info,
  loading,
  failed,
  mediaLocations,
  canManageStorage,
  canAddShare,
  canAddFolder,
  refresh,
} = useStorageInfo();

// the folder being browsed; null while the locations are listed
const position = ref<StoragePosition | null>(null);
const subfolders = ref<string[]>([]);
const loadingFolders = ref(false);
// only the answer to the latest folder request is applied: a slow share may answer
// after the user has moved on to another folder
let folderRequest = 0;

const canAddLocation = computed(() => canAddShare.value || canAddFolder.value);

const selectedPath = computed(() =>
  typeof props.entry.value === "string" && props.entry.value
    ? props.entry.value
    : null,
);

const selectedPosition = computed(() =>
  selectedPath.value
    ? findStoragePosition(mediaLocations.value, selectedPath.value)
    : null,
);

// a stored path outside every location (a legacy source, a location gone since)
// stays the selection until the user picks another folder
const selectionOutsideLocations = computed(
  () => !!info.value && !!selectedPath.value && !selectedPosition.value,
);

// how a folder request ended: the folder is shown, it could not be opened (the view
// stays where it was), or a newer request took over
type FolderResult = "opened" | "failed" | "superseded";

const openFolder = async (target: StoragePosition): Promise<FolderResult> => {
  const request = ++folderRequest;
  loadingFolders.value = true;
  try {
    const names = await api.getStorageFolders(
      joinStoragePath(target.location.path, target.segments),
    );
    if (request !== folderRequest) return "superseded";
    subfolders.value = names;
    position.value = target;
    // the folder on screen is the one the entry holds; a stored path that already
    // names it is kept the way it is written
    const path = joinStoragePath(target.location.path, target.segments);
    if (!sameStoragePath(path, selectedPath.value)) emit("update:value", path);
    return "opened";
  } catch (error) {
    if (request !== folderRequest) return "superseded";
    toast.error(
      storageErrorText(error, $t("settings.folder_picker.browse_failed")),
    );
    return "failed";
  } finally {
    if (request === folderRequest) loadingFolders.value = false;
  }
};

const showLocations = () => {
  // back at the locations, no folder request is waited for any more
  folderRequest++;
  loadingFolders.value = false;
  position.value = null;
};

const onNavigate = (target: StoragePosition | null) => {
  if (target) void openFolder(target);
  else showLocations();
};

// the location that holds the selected folder opens on that folder, or on its root
// when that folder is gone
const openLocation = async (location: StorageLocation) => {
  const segments =
    selectedPosition.value?.location.path === location.path
      ? selectedPosition.value.segments
      : [];
  if (segments.length > 0) {
    if ((await openFolder({ location, segments })) !== "failed") return;
  }
  await openFolder({ location, segments: [] });
};

// a location added from the picker is the one to use; it is listed once the storage is
// fetched again
const pickAddedLocation = async (location: StorageLocation) => {
  await refresh();
  emit("update:value", location.path);
};

const reload = async () => {
  const request = folderRequest;
  await refresh();
  // a refresh that failed has said so and keeps the storage it had, so the folder on
  // screen stays as well
  if (failed.value) return;
  // where the user went while the storage was fetched is what stays on screen
  if (request !== folderRequest) return;
  const current = position.value;
  if (!current) return;
  // the folder may have gone in the meantime, then the view falls back to the root of
  // its location, and to the locations when the location is gone or fails as well
  const location = mediaLocations.value.find(
    (item) => item.path === current.location.path,
  );
  if (location?.available) {
    const reopened = await openFolder({ location, segments: current.segments });
    if (reopened !== "failed") return;
    if (current.segments.length > 0) {
      const root = await openFolder({ location, segments: [] });
      if (root !== "failed") return;
    }
  }
  showLocations();
};

onMounted(refresh);
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <div class="flex items-center gap-2">
      <span v-if="label" :id="labelId" class="text-muted-foreground text-sm">{{
        label
      }}</span>
      <Button
        type="button"
        variant="ghost"
        size="icon-sm"
        class="ml-auto"
        :disabled="disabled || loading || loadingFolders"
        :aria-label="$t('refresh')"
        :title="$t('refresh')"
        data-testid="folder-picker-refresh"
        @click="reload"
      >
        <RefreshCw :class="{ 'animate-spin': loading }" />
      </Button>
    </div>
    <div
      role="group"
      :aria-labelledby="label ? labelId : undefined"
      class="flex flex-col gap-3 rounded-md border p-3"
    >
      <!-- a stored folder outside every location is only shown here -->
      <div
        v-if="selectionOutsideLocations && selectedPath"
        class="bg-muted/50 flex items-start gap-2 rounded-md px-3 py-2"
        data-testid="folder-picker-outside"
      >
        <FolderCheck class="text-primary mt-0.5 size-4 shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-sm font-medium">
            <StoragePath :path="selectedPath" />
          </span>
          <span class="text-muted-foreground text-xs">
            {{ $t("settings.folder_picker.outside_locations") }}
          </span>
        </div>
      </div>

      <div v-if="!info" class="flex min-h-24 items-center justify-center">
        <span v-if="failed" class="text-muted-foreground text-sm">
          {{ $t("settings.storage.load_failed") }}
        </span>
        <Spinner v-else class="size-6" />
      </div>
      <FolderPickerEmpty
        v-else-if="mediaLocations.length === 0"
        :can-manage-storage="canManageStorage"
        :can-add="canAddLocation"
      >
        <FolderPickerAddLocation
          :can-add-share="canAddShare"
          :can-add-folder="canAddFolder"
          :share-types="info.supported_share_types"
          :share-versions="info.supported_share_versions"
          :disabled="disabled || loading"
          class="justify-center"
          @added="pickAddedLocation"
        />
      </FolderPickerEmpty>
      <FolderPickerBrowser
        v-else-if="position"
        :position="position"
        :subfolders="subfolders"
        :loading="loadingFolders || loading"
        :disabled="disabled"
        @navigate="onNavigate"
      />
      <template v-else>
        <FolderPickerLocations
          :locations="mediaLocations"
          :selected-location-path="selectedPosition?.location.path"
          :selected-path="selectedPath"
          :disabled="disabled || loadingFolders || loading"
          @open="openLocation"
        />
        <FolderPickerAddLocation
          v-if="canAddLocation"
          :can-add-share="canAddShare"
          :can-add-folder="canAddFolder"
          :share-types="info.supported_share_types"
          :share-versions="info.supported_share_versions"
          :disabled="disabled || loadingFolders || loading"
          class="border-t pt-3"
          @added="pickAddedLocation"
        />
      </template>
    </div>
  </div>
</template>
