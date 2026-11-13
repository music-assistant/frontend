<template>
  <DropdownMenu>
    <!-- on a wide screen the field names the current sort with its order right
         beside it, and a little further the view; a phone has the icon only -->
    <DropdownMenuTrigger v-if="!compact" as-child>
      <Button
        variant="outline"
        class="max-w-48 min-w-0 gap-3 px-3"
        :aria-label="triggerAriaLabel"
        :disabled="!hasMenu"
      >
        <span v-if="hasSortOptions" class="flex min-w-0 items-center gap-1">
          <span class="min-w-0 truncate">{{ currentLabel }}</span>
          <component
            :is="directionIcon"
            v-if="selectedOption?.supports_direction"
            aria-hidden="true"
          />
        </span>
        <component
          :is="currentView.icon"
          v-if="currentView"
          class="text-muted-foreground"
        />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuTrigger v-else as-child>
      <Button
        variant="ghost"
        size="icon-lg"
        :title="compactLabel"
        :aria-label="compactLabel"
        :disabled="!hasMenu"
      >
        <component :is="compactIcon" class="size-[22px]" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-56">
      <DropdownMenuLabel
        v-if="titled && hasSortOptions"
        :class="MENU_SECTION_LABEL_CLASS"
      >
        {{ $t("sort.sort_by") }}
      </DropdownMenuLabel>
      <!-- picking the sort it is on flips its order, as the arrow shows; the
           menu stays open for another pick until a click outside closes it -->
      <DropdownMenuRadioGroup
        v-if="hasSortOptions"
        :model-value="current.field"
      >
        <DropdownMenuRadioItem
          v-for="option in options"
          :key="option.field"
          :value="option.field"
          class="cursor-pointer gap-3 pl-2 data-[state=checked]:text-primary"
          @select="(event: Event) => pickSortOption(event, option)"
        >
          <template #indicator-icon><span></span></template>
          <span class="min-w-0 flex-1 truncate">{{
            sortOptionLabel(option)
          }}</span>
          <template
            v-if="current.field === option.field && option.supports_direction"
          >
            <component :is="directionIcon" aria-hidden="true" />
            <span class="sr-only">{{
              sortDirectionLabel(current.direction)
            }}</span>
          </template>
        </DropdownMenuRadioItem>
      </DropdownMenuRadioGroup>
      <template v-if="showViewSection">
        <DropdownMenuSeparator v-if="hasSortOptions" />
        <ListingViewModeRow
          v-if="!fixedView"
          :model-value="viewMode"
          @update:model-value="(value) => emit('view-mode', value)"
        />
        <GridSizeSlider
          v-if="gridControls && showGridControls"
          v-bind="gridControls"
        />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
import GridSizeSlider from "@/components/GridSizeSlider.vue";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useLibrarySorting } from "@/composables/useLibrarySorting";
import type { GridSizeControls } from "@/helpers/grid_size";
import { SortDirection, type SortOptionInfo } from "@/plugins/api/interfaces";
import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";
import {
  MENU_SECTION_LABEL_CLASS,
  VIEW_MODES,
  type ListingViewMode,
} from "./constants";
import ListingViewModeRow from "./ListingViewModeRow.vue";

/**
 * A library page's sort menu: picking the sort it is on flips its order, and
 * unless the page fixes the view, the menu picks that too.
 */
const props = defineProps<{
  options: SortOptionInfo[];
  sortBy: string;
  viewMode: string;
  // the page picks the view itself: only the thumbs view's controls show
  fixedView?: boolean;
  // the cover size and action buttons, shown under the thumbs view
  gridControls?: GridSizeControls;
  // a phone has room for the icon only
  compact: boolean;
}>();

const emit = defineEmits<{
  "sort-by": [value: string];
  "view-mode": [value: ListingViewMode];
}>();

const { t } = useI18n();

const { current, selectedOption, sortByQuickOption } = useLibrarySorting(
  computed(() => props.options),
  computed(() => props.sortBy),
);

const sortOptionLabel = (option: SortOptionInfo) =>
  t(`sort.${option.label_key ?? option.field}`);

const sortDirectionLabel = (direction: SortDirection) =>
  t(direction === SortDirection.ASC ? "sort.ascending" : "sort.descending");

const directionIcon = computed(() =>
  current.value.direction === SortDirection.DESC ? ArrowDown : ArrowUp,
);

const currentLabel = computed(() =>
  selectedOption.value ? sortOptionLabel(selectedOption.value) : "",
);

// the field's name for screen readers, with the order it shows as an arrow
const triggerLabel = computed(() =>
  selectedOption.value?.supports_direction
    ? `${currentLabel.value}, ${sortDirectionLabel(current.value.direction)}`
    : currentLabel.value,
);

const showGridControls = computed(
  () => !!props.gridControls && props.viewMode === "panel",
);

const showViewSection = computed(
  () => !props.fixedView || showGridControls.value,
);

// a listing the server keeps in its own order has only the view to pick
const hasSortOptions = computed(() => props.options.length > 0);

const hasMenu = computed(() => hasSortOptions.value || showViewSection.value);

// with more than the sort in it, or opened from the field, each part gets a title
const titled = computed(() => !props.compact || showViewSection.value);

// the field shows the view the listing is in beside the sort, when it can be picked
const currentView = computed(() =>
  props.fixedView
    ? undefined
    : VIEW_MODES.find((view) => view.value === props.viewMode),
);

const triggerAriaLabel = computed(() => {
  if (hasSortOptions.value)
    return t("sort.sort_by_current", [triggerLabel.value]);
  return currentView.value
    ? t("tooltip.view_mode_current", [t(currentView.value.label)])
    : t("tooltip.view_mode");
});

const compactLabel = computed(() =>
  hasSortOptions.value ? t("tooltip.sort_options") : t("tooltip.view_mode"),
);

const compactIcon = computed(() =>
  hasSortOptions.value ? ArrowUpDown : (currentView.value?.icon ?? ArrowUpDown),
);

const pickSortOption = (event: Event, option: SortOptionInfo) => {
  event.preventDefault();
  emit("sort-by", sortByQuickOption(option));
};
</script>
