<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { joinStoragePath, type StoragePosition } from "@/helpers/storage";
import { Check, ChevronRight, Folder } from "@lucide/vue";
import { computed } from "vue";

/**
 * One folder of a storage location in a folder picker: the trail back to the
 * locations, its subfolders to go deeper, and the button that picks it.
 */
const props = defineProps<{
  position: StoragePosition;
  subfolders: string[];
  // the path the entry holds now
  selectedPath: string | null;
  // the subfolders of another folder are on their way
  loading?: boolean;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  // null goes back to the list of locations
  navigate: [position: StoragePosition | null];
  use: [];
}>();

const currentPath = computed(() =>
  joinStoragePath(props.position.location.path, props.position.segments),
);

const isSelected = computed(() => currentPath.value === props.selectedPath);

// the location itself heads the trail, followed by one crumb per subfolder
const crumbs = computed(() => [
  props.position.location.name,
  ...props.position.segments,
]);

const openCrumb = (depth: number) =>
  emit("navigate", {
    location: props.position.location,
    segments: props.position.segments.slice(0, depth),
  });

const openSubfolder = (name: string) =>
  emit("navigate", {
    location: props.position.location,
    segments: [...props.position.segments, name],
  });
</script>

<template>
  <div class="flex flex-col gap-2">
    <nav :aria-label="$t('settings.folder_picker.breadcrumb')">
      <ol class="flex flex-wrap items-center gap-1 text-sm">
        <li>
          <button
            type="button"
            class="text-primary hover:underline disabled:opacity-60"
            :disabled="disabled || loading"
            data-testid="folder-picker-crumb"
            @click="emit('navigate', null)"
          >
            {{ $t("settings.folder_picker.all_locations") }}
          </button>
        </li>
        <li
          v-for="(crumb, depth) in crumbs"
          :key="depth"
          class="flex min-w-0 items-center gap-1"
        >
          <ChevronRight class="text-muted-foreground size-3.5 shrink-0" />
          <span
            v-if="depth === crumbs.length - 1"
            class="truncate font-medium"
            aria-current="location"
          >
            {{ crumb }}
          </span>
          <button
            v-else
            type="button"
            class="text-primary truncate hover:underline disabled:opacity-60"
            :disabled="disabled || loading"
            data-testid="folder-picker-crumb"
            @click="openCrumb(depth)"
          >
            {{ crumb }}
          </button>
        </li>
      </ol>
    </nav>

    <div
      class="flex max-h-60 min-h-24 flex-col overflow-y-auto rounded-md border"
    >
      <div v-if="loading" class="flex flex-1 items-center justify-center py-6">
        <Spinner class="size-5" />
      </div>
      <p
        v-else-if="subfolders.length === 0"
        class="text-muted-foreground m-0 p-3 text-sm"
      >
        {{ $t("settings.folder_picker.no_subfolders") }}
      </p>
      <ul v-else class="flex flex-col py-1">
        <li v-for="name in subfolders" :key="name">
          <button
            type="button"
            class="hover:bg-accent/50 flex w-full items-center gap-2 px-3 py-1.5 text-left text-sm transition-colors disabled:opacity-60 disabled:hover:bg-transparent"
            :disabled="disabled"
            :aria-label="$t('settings.folder_picker.open_folder', { name })"
            data-testid="folder-picker-subfolder"
            @click="openSubfolder(name)"
          >
            <Folder class="text-muted-foreground size-4 shrink-0" />
            <span class="min-w-0 flex-1 truncate">{{ name }}</span>
            <ChevronRight class="text-muted-foreground size-4 shrink-0" />
          </button>
        </li>
      </ul>
    </div>

    <div class="flex flex-wrap items-center justify-between gap-2">
      <span class="text-muted-foreground min-w-0 text-xs break-all">
        {{ currentPath }}
      </span>
      <Button
        type="button"
        size="sm"
        :variant="isSelected ? 'secondary' : 'default'"
        :disabled="disabled || loading || isSelected"
        data-testid="folder-picker-use"
        @click="emit('use')"
      >
        <Check v-if="isSelected" />
        {{
          isSelected
            ? $t("settings.folder_picker.folder_selected")
            : $t("settings.folder_picker.use_folder")
        }}
      </Button>
    </div>
  </div>
</template>
