<template>
  <div
    role="group"
    :aria-label="$t('listing_filters.controls')"
    class="flex items-center"
    :class="compact ? 'gap-0' : 'mx-2 gap-1'"
  >
    <LibrarySortControls
      v-if="sortOptions.length || showViewModes"
      :mode="compact ? 'menu' : 'button'"
      :options="sortOptions"
      :sort-by="sortBy"
      :view-mode="showViewModes ? viewMode : undefined"
      @sort-by="(value) => emit('sort-by', value)"
      @view-mode="(value) => emit('view-mode', value)"
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
import type { ListingViewMode } from "./constants";
import ListingFiltersButton from "./ListingFiltersButton.vue";

defineProps<{
  sortOptions: SortOptionInfo[];
  sortBy: string;
  viewMode: string;
  // off where the page picks the view itself
  showViewModes: boolean;
  filters: ListingFilter[];
  activeFilterCount: number;
  // a phone has room for icons only
  compact: boolean;
}>();

const emit = defineEmits<{
  "sort-by": [value: string];
  "view-mode": [value: ListingViewMode];
  "clear-filters": [];
}>();
</script>
