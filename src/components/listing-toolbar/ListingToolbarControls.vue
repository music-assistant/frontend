<template>
  <div
    role="group"
    :aria-label="$t('listing_filters.controls')"
    class="flex items-center"
    :class="compact ? 'gap-0' : 'mx-2 gap-2'"
  >
    <LibrarySortControls
      v-if="sortOptions.length"
      :mode="compact ? 'menu' : 'split'"
      :options="sortOptions"
      :sort-by="sortBy"
      @sort-by="(value) => emit('sort-by', value)"
    />
    <ListingViewToggle
      v-if="showViewToggle && !compact"
      :model-value="viewMode"
      @update:model-value="(value) => emit('view-mode', value)"
    />
    <ListingFiltersButton
      v-if="filters.length"
      :filters="filters"
      :active-count="activeFilterCount"
      :compact="compact"
      @clear="emit('clear-filters')"
    />
  </div>
</template>

<script setup lang="ts">
import LibrarySortControls from "@/components/LibrarySortControls.vue";
import type { ListingFilter } from "@/helpers/listing_filters";
import type { SortOptionInfo } from "@/plugins/api/interfaces";
import ListingFiltersButton from "./ListingFiltersButton.vue";
import ListingViewToggle from "./ListingViewToggle.vue";

defineProps<{
  sortOptions: SortOptionInfo[];
  sortBy: string;
  viewMode: string;
  // off where the page picks the view itself
  showViewToggle: boolean;
  filters: ListingFilter[];
  activeFilterCount: number;
  // a phone shows icons only, and keeps the view in the overflow menu
  compact: boolean;
}>();

const emit = defineEmits<{
  "sort-by": [value: string];
  "view-mode": [value: string];
  "clear-filters": [];
}>();
</script>
