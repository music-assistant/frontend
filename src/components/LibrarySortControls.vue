<template>
  <div v-if="mode !== 'chips'" class="flex min-w-0 items-center gap-1">
    <DropdownMenu>
      <!-- the field names the current sort, and shows the view, and opens the menu -->
      <DropdownMenuTrigger v-if="mode === 'button'" as-child>
        <Button
          variant="outline"
          class="max-w-44 min-w-0 gap-2 px-3"
          :aria-label="$t('sort.sort_by_current', [currentLabel])"
          :disabled="!hasMenu"
        >
          <span class="min-w-0 truncate">{{ currentLabel }}</span>
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
              <component
                :is="
                  current.direction === SortDirection.DESC ? ArrowDown : ArrowUp
                "
                aria-hidden="true"
              />
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
  </div>

  <div
    v-else-if="quickOptions.length"
    class="flex gap-2 overflow-x-auto px-3 py-2"
    role="group"
    :aria-label="$t('tooltip.sort_options')"
  >
    <Button
      v-for="option in quickOptions"
      :key="option.field"
      variant="outline"
      size="sm"
      class="shrink-0 gap-2"
      :class="{
        'border-primary bg-accent text-accent-foreground':
          current.field === option.field,
      }"
      :aria-pressed="current.field === option.field"
      :aria-label="quickSortAriaLabel(option)"
      :title="quickSortAriaLabel(option)"
      @click="changeQuickSort(option)"
    >
      {{ sortOptionLabel(option) }}
      <ArrowDown
        v-if="quickSortDirection(option) === SortDirection.DESC"
        class="size-4"
      />
      <ArrowUp v-else class="size-4" />
    </Button>
  </div>
</template>

<script setup lang="ts">
import {
  MENU_SECTION_LABEL_CLASS,
  VIEW_MODES,
  type ListingViewMode,
} from "@/components/listing-toolbar/constants";
import ListingViewModeRow from "@/components/listing-toolbar/ListingViewModeRow.vue";
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
import { SortDirection, type SortOptionInfo } from "@/plugins/api/interfaces";
import { useLibrarySorting } from "@/composables/useLibrarySorting";
import { ArrowDown, ArrowUp, ArrowUpDown } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  // menu: an icon that opens the sort menu; button: the current sort, opening
  // the menu; chips: the quick sorts. Picking the sort it is on flips its order
  mode: "menu" | "button" | "chips";
  options: SortOptionInfo[];
  sortBy: string;
  // given, the menu also picks how the listing is shown
  viewMode?: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "sort-by": [value: string];
  "view-mode": [value: ListingViewMode];
}>();

const { t } = useI18n();

const sorting = useLibrarySorting(
  computed(() => props.options),
  computed(() => props.sortBy),
);
const { current, selectedOption, quickOptions, sortByQuickOption } = sorting;

const sortOptionLabel = (option: SortOptionInfo) =>
  t(`sort.${option.label_key ?? option.field}`);

const sortDirectionLabel = (direction: SortDirection) =>
  t(direction === SortDirection.ASC ? "sort.ascending" : "sort.descending");

const currentLabel = computed(() =>
  selectedOption.value ? sortOptionLabel(selectedOption.value) : "",
);

const hasMenu = computed(
  () => props.options.length > 0 || props.viewMode !== undefined,
);

// with more than the sort in it, or opened from the field, each part gets a title
const titled = computed(
  () => props.mode === "button" || props.viewMode !== undefined,
);

// the field shows the view the listing is in beside the sort
const currentView = computed(() =>
  VIEW_MODES.find((view) => view.value === props.viewMode),
);

const quickSortDirection = (option: SortOptionInfo) =>
  current.value.field === option.field
    ? current.value.direction
    : (option.default_direction ?? SortDirection.ASC);

const quickSortAriaLabel = (option: SortOptionInfo) =>
  `${sortOptionLabel(option)}, ${sortDirectionLabel(quickSortDirection(option))}`;

const changeQuickSort = (option: SortOptionInfo) =>
  emit("sort-by", sortByQuickOption(option));

const pickSortOption = (event: Event, option: SortOptionInfo) => {
  event.preventDefault();
  changeQuickSort(option);
};
</script>
