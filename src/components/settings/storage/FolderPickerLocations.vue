<script setup lang="ts">
import { Badge } from "@/components/ui/badge";
import { STORAGE_KIND_ICONS, STORAGE_KIND_LABEL_KEYS } from "@/helpers/storage";
import type { StorageLocation } from "@/plugins/api/interfaces";
import { ChevronRight } from "@lucide/vue";

/** The storage locations a folder picker starts from; an unavailable one cannot be opened. */
defineProps<{
  locations: StorageLocation[];
  disabled?: boolean;
}>();

const emit = defineEmits<{ open: [location: StorageLocation] }>();
</script>

<template>
  <ul
    class="flex flex-col gap-1"
    :aria-label="$t('settings.folder_picker.locations')"
  >
    <li v-for="location in locations" :key="location.path">
      <button
        type="button"
        class="hover:bg-accent/50 flex w-full items-center gap-3 rounded-md px-3 py-2 text-left transition-colors disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:bg-transparent"
        :disabled="disabled || !location.available"
        data-testid="folder-picker-location"
        @click="emit('open', location)"
      >
        <component
          :is="STORAGE_KIND_ICONS[location.kind]"
          class="text-muted-foreground size-5 shrink-0"
        />
        <span class="flex min-w-0 flex-1 flex-col gap-0.5">
          <span class="flex flex-wrap items-center gap-2 text-sm font-medium">
            {{ location.name }}
            <Badge as="span" variant="secondary">
              {{ $t(STORAGE_KIND_LABEL_KEYS[location.kind]) }}
            </Badge>
            <Badge v-if="!location.available" as="span" variant="destructive">
              {{ $t("settings.storage.unavailable") }}
            </Badge>
          </span>
          <span class="text-muted-foreground truncate text-xs">
            {{ location.path }}
          </span>
          <span
            v-if="!location.available && location.error"
            class="text-destructive text-xs"
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
