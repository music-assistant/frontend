<script setup lang="ts">
import FolderPickerBrowser from "@/components/settings/storage/FolderPickerBrowser.vue";
import FolderPickerLocations from "@/components/settings/storage/FolderPickerLocations.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import { useStorageInfo } from "@/composables/useStorageInfo";
import type { ConfigEntryUI } from "@/helpers/config_entry_ui";
import {
  findStoragePosition,
  joinStoragePath,
  storageErrorText,
  type StoragePosition,
} from "@/helpers/storage";
import { api } from "@/plugins/api";
import {
  type ConfigValueType,
  Scope,
  type StorageLocation,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { $t } from "@/plugins/i18n";
import {
  ExternalLink,
  Folder,
  FolderCheck,
  HardDrive,
  RefreshCw,
} from "@lucide/vue";
import { computed, onMounted, ref, useId } from "vue";
import { useRouter } from "vue-router";
import { toast } from "vue-sonner";

/**
 * Picks a folder on one of the server's media locations; the entry value is its
 * absolute path. There is deliberately no way to type a path.
 */
const props = defineProps<{
  entry: ConfigEntryUI;
  label: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{ "update:value": [value: ConfigValueType] }>();

const router = useRouter();
const labelId = useId();
const { info, loading, failed, mediaLocations, refresh } = useStorageInfo();

// the folder being browsed; null while the locations are listed
const position = ref<StoragePosition | null>(null);
const subfolders = ref<string[]>([]);
const loadingFolders = ref(false);

// only who can add a location there is pointed to the Storage page; for anyone else
// it lists nothing the picker does not show already
const canManageStorage = computed(() =>
  authManager.hasScope(Scope.CONFIG_PROVIDERS_WRITE),
);
const storageSettingsHref = router.resolve({ name: "storagesettings" }).href;

const selectedPath = computed(() =>
  typeof props.entry.value === "string" && props.entry.value
    ? props.entry.value
    : null,
);

// a stored path outside every location (a legacy source, a location gone since)
// stays the selection until the user picks another folder
const selectionOutsideLocations = computed(
  () =>
    !!info.value &&
    !!selectedPath.value &&
    !findStoragePosition(mediaLocations.value, selectedPath.value),
);

const openFolder = async (target: StoragePosition) => {
  loadingFolders.value = true;
  try {
    subfolders.value = await api.getStorageFolders(
      joinStoragePath(target.location.path, target.segments),
    );
    position.value = target;
  } catch (error) {
    toast.error(
      storageErrorText(error, $t("settings.folder_picker.browse_failed")),
    );
  } finally {
    loadingFolders.value = false;
  }
};

const onNavigate = (target: StoragePosition | null) => {
  if (target) void openFolder(target);
  else position.value = null;
};

const openLocation = (location: StorageLocation) =>
  openFolder({ location, segments: [] });

const useCurrentFolder = () => {
  if (!position.value) return;
  emit(
    "update:value",
    joinStoragePath(position.value.location.path, position.value.segments),
  );
};

const reload = async () => {
  await refresh();
  const current = position.value;
  if (!current) return;
  // the location may have gone away or become unavailable in the meantime
  const location = mediaLocations.value.find(
    (item) => item.path === current.location.path,
  );
  if (location?.available) {
    await openFolder({ location, segments: current.segments });
  } else {
    position.value = null;
  }
};

onMounted(refresh);
</script>

<template>
  <div class="flex w-full flex-col gap-2 py-1">
    <span v-if="label" :id="labelId" class="text-muted-foreground text-sm">{{
      label
    }}</span>
    <div
      role="group"
      :aria-labelledby="label ? labelId : undefined"
      class="flex flex-col gap-3 rounded-md border p-3"
    >
      <div
        class="bg-muted/50 flex items-start gap-2 rounded-md px-3 py-2"
        data-testid="folder-picker-selection"
      >
        <FolderCheck
          v-if="selectedPath"
          class="text-primary mt-0.5 size-4 shrink-0"
        />
        <Folder v-else class="text-muted-foreground mt-0.5 size-4 shrink-0" />
        <div class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="text-muted-foreground text-xs">
            {{ $t("settings.folder_picker.selected") }}
          </span>
          <span class="text-sm font-medium break-all">
            {{ selectedPath ?? $t("settings.folder_picker.none_selected") }}
          </span>
          <span
            v-if="selectionOutsideLocations"
            class="text-muted-foreground text-xs"
            data-testid="folder-picker-outside"
          >
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
      <Empty
        v-else-if="mediaLocations.length === 0"
        class="border"
        data-testid="folder-picker-empty"
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <HardDrive />
          </EmptyMedia>
          <EmptyTitle>{{
            $t("settings.folder_picker.empty_title")
          }}</EmptyTitle>
          <EmptyDescription>
            {{
              canManageStorage
                ? $t("settings.folder_picker.empty_text")
                : $t("settings.storage.music_locations_empty")
            }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
      <FolderPickerBrowser
        v-else-if="position"
        :position="position"
        :subfolders="subfolders"
        :selected-path="selectedPath"
        :loading="loadingFolders"
        :disabled="disabled"
        @navigate="onNavigate"
        @use="useCurrentFolder"
      />
      <FolderPickerLocations
        v-else
        :locations="mediaLocations"
        :disabled="disabled || loadingFolders"
        @open="openLocation"
      />

      <div class="flex items-center gap-2">
        <Button
          v-if="canManageStorage"
          as="a"
          variant="link"
          size="sm"
          class="h-auto px-0"
          :href="storageSettingsHref"
          target="_blank"
          rel="noopener noreferrer"
          data-testid="folder-picker-manage"
        >
          {{ $t("settings.folder_picker.manage") }}
          <ExternalLink />
        </Button>
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
    </div>
  </div>
</template>
