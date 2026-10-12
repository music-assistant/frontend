<script setup lang="ts">
import StoragePath from "@/components/settings/storage/StoragePath.vue";
import { Badge } from "@/components/ui/badge";
import {
  isNamedByKind,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
  storageLocationName,
} from "@/helpers/storage";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { ChevronRight, FolderCheck } from "@lucide/vue";

/** The storage locations a folder picker starts from; an unavailable one cannot be opened. */
defineProps<{
  locations: StorageLocation[];
  // the path of the location that holds the selected folder, if any
  selectedLocationPath?: string | null;
  disabled?: boolean;
}>();

const emit = defineEmits<{ open: [location: StorageLocation] }>();
</script>

<template>
  <ul
    class="m-0 flex list-none flex-col gap-1 p-0"
    :aria-label="$t('settings.folder_picker.locations')"
  >
    <li v-for="location in locations" :key="location.path">
      <button
        type="button"
        class="hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent"
        :class="{ 'opacity-60': disabled }"
        :disabled="disabled || !location.available"
        data-testid="folder-picker-location"
        @click="emit('open', location)"
      >
        <component
          :is="STORAGE_KIND_ICONS[location.kind]"
          class="text-muted-foreground size-5 shrink-0"
          :class="{ 'opacity-60': !location.available }"
        />
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span
            class="flex flex-wrap items-center gap-2 text-sm font-medium"
            :class="{ 'opacity-60': !location.available }"
          >
            {{ storageLocationName(location) }}
            <Badge
              v-if="!isNamedByKind(location)"
              as="span"
              variant="secondary"
            >
              {{ $t(STORAGE_KIND_LABEL_KEYS[location.kind]) }}
            </Badge>
            <Badge
              v-if="location.read_only"
              as="span"
              variant="outline"
              data-testid="folder-picker-read-only"
            >
              {{ $t("settings.storage.read_only") }}
            </Badge>
            <Badge v-if="!location.available" as="span" variant="destructive">
              {{ $t("settings.storage.unavailable") }}
            </Badge>
            <Badge
              v-if="location.path === selectedLocationPath"
              as="span"
              data-testid="folder-picker-holds-selection"
            >
              <FolderCheck />
              {{ $t("settings.folder_picker.holds_selection") }}
            </Badge>
          </span>
          <span
            class="text-muted-foreground text-xs"
            :class="{ 'opacity-60': !location.available }"
          >
            <StoragePath :path="location.path" />
          </span>
          <!-- the reason stays readable while the rest of the row is dimmed -->
          <span
            v-if="!location.available && location.error"
            class="text-destructive text-xs"
            data-testid="folder-picker-error"
          >
            {{ location.error }}
          </span>
        </span>
        <ChevronRight
          v-if="location.available"
          class="text-muted-foreground size-4 shrink-0"
        />
      </button>
    </li>
  </ul>
</template>
