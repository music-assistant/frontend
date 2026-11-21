<script setup lang="ts">
import StoragePath from "@/components/settings/storage/StoragePath.vue";
import { Badge } from "@/components/ui/badge";
import {
  isNamedByKind,
  STORAGE_KIND_ICONS,
  STORAGE_KIND_LABEL_KEYS,
  storageLocationName,
} from "@/helpers/storage";
import { cn } from "@/lib/utils";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { Check, ChevronRight } from "@lucide/vue";

/** The storage locations a folder picker starts from; an unavailable one cannot be opened. */
defineProps<{
  locations: StorageLocation[];
  // the path of the location that holds the selected folder, if any
  selectedLocationPath?: string | null;
  // the selected folder, shown on the location that holds it
  selectedPath?: string | null;
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
        :class="
          cn(
            'hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:hover:bg-transparent',
            location.path === selectedLocationPath &&
              'bg-primary/10 hover:bg-primary/15',
            disabled && 'opacity-60',
          )
        "
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
          </span>
          <span
            class="text-muted-foreground text-xs"
            :class="{ 'opacity-60': !location.available }"
          >
            <template v-if="!isNamedByKind(location)">
              {{ $t(STORAGE_KIND_LABEL_KEYS[location.kind]) }} ·
            </template>
            <!-- the location holding the selected folder names that folder -->
            <StoragePath
              v-if="location.path === selectedLocationPath && selectedPath"
              :path="selectedPath"
              class="text-foreground font-medium"
              data-testid="folder-picker-selected-path"
            />
            <StoragePath v-else :path="location.path" />
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
        <Check
          v-if="location.path === selectedLocationPath"
          class="text-primary size-4 shrink-0"
          role="img"
          :aria-label="$t('settings.folder_picker.selected')"
          data-testid="folder-picker-holds-selection"
        />
        <ChevronRight
          v-if="location.available"
          class="text-muted-foreground size-4 shrink-0"
        />
      </button>
    </li>
  </ul>
</template>
