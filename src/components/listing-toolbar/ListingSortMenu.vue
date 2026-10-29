<template>
  <DropdownMenu>
    <!-- on a wide screen the field names the current sort with its order right
         beside it, and a little further the view; a phone has the icon only -->
    <DropdownMenuTrigger v-if="!compact" as-child>
      <Button
        variant="outline"
        class="max-w-48 min-w-0 gap-3 px-3"
        :aria-label="$t('sort.sort_by_current', [triggerLabel])"
        :disabled="!hasMenu"
      >
        <span class="flex min-w-0 items-center gap-1">
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
        :title="$t('tooltip.sort_options')"
        :aria-label="$t('tooltip.sort_options')"
        :disabled="!hasMenu"
      >
        <ArrowUpDown class="size-[22px]" />
      </Button>
    </DropdownMenuTrigger>
    <DropdownMenuContent align="end" class="min-w-56">
      <DropdownMenuLabel v-if="titled" :class="MENU_SECTION_LABEL_CLASS">
        {{ $t("sort.sort_by") }}
      </DropdownMenuLabel>
      <!-- picking the sort it is on flips its order, as the arrow shows; the
           menu stays open for another pick until a click outside closes it -->
      <DropdownMenuRadioGroup :model-value="current.field">
        <DropdownMenuRadioItem
          v-for="option in options"
          :key="option.field"
          :value="option.field"
          class="gap-3 pl-2 data-[state=checked]:text-primary"
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
      <template v-if="viewMode !== undefined">
        <DropdownMenuSeparator />
        <ListingViewModeRow
          :model-value="viewMode"
          @update:model-value="(value) => emit('view-mode', value)"
        />
      </template>
    </DropdownMenuContent>
  </DropdownMenu>
</template>

<script setup lang="ts">
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
 * with a view given, the menu picks that too.
 */
const props = defineProps<{
  options: SortOptionInfo[];
  sortBy: string;
  // off where the page picks the view itself
  viewMode?: string;
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

const hasMenu = computed(
  () => props.options.length > 0 || props.viewMode !== undefined,
);

// with more than the sort in it, or opened from the field, each part gets a title
const titled = computed(() => !props.compact || props.viewMode !== undefined);

// the field shows the view the listing is in beside the sort
const currentView = computed(() =>
  VIEW_MODES.find((view) => view.value === props.viewMode),
);

const pickSortOption = (event: Event, option: SortOptionInfo) => {
  event.preventDefault();
  emit("sort-by", sortByQuickOption(option));
};
</script>
