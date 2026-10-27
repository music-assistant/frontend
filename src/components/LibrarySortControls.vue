<template>
  <div v-if="mode !== 'chips'" class="flex min-w-0 items-center gap-1">
    <DropdownMenu>
      <!-- the field names the current sort and opens the menu -->
      <DropdownMenuTrigger v-if="mode === 'button'" as-child>
        <Button
          variant="outline"
          class="w-46 min-w-0 justify-start gap-2 px-3"
          :aria-label="$t('sort.sort_by_current', [currentLabel])"
          :disabled="!hasMenu"
        >
          <ArrowUpDown class="text-muted-foreground" />
          <span class="min-w-0 flex-1 truncate text-left">
            {{ currentLabel }}
          </span>
          <ChevronDown class="text-muted-foreground" />
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
        <DropdownMenuRadioGroup
          :model-value="current.field"
          @update:model-value="selectSortOption"
        >
          <DropdownMenuRadioItem
            v-for="option in options"
            :key="option.field"
            :value="option.field"
            class="gap-3"
          >
            <template #indicator-icon>
              <Check class="size-3.5" />
            </template>
            <span class="min-w-0 flex-1 truncate">{{
              sortOptionLabel(option)
            }}</span>
          </DropdownMenuRadioItem>
        </DropdownMenuRadioGroup>
        <template v-if="selectedOption?.supports_direction">
          <DropdownMenuSeparator />
          <DropdownMenuLabel v-if="titled" :class="MENU_SECTION_LABEL_CLASS">
            {{ $t("sort.order") }}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            :model-value="current.direction"
            @update:model-value="selectSortDirection"
          >
            <DropdownMenuRadioItem :value="SortDirection.ASC" class="gap-3">
              <template #indicator-icon>
                <Check class="size-3.5" />
              </template>
              <ArrowUp class="size-4" />
              <span class="min-w-0 flex-1 truncate">{{
                $t("sort.ascending")
              }}</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem :value="SortDirection.DESC" class="gap-3">
              <template #indicator-icon>
                <Check class="size-3.5" />
              </template>
              <ArrowDown class="size-4" />
              <span class="min-w-0 flex-1 truncate">{{
                $t("sort.descending")
              }}</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
        </template>
        <template v-if="viewMode !== undefined">
          <DropdownMenuSeparator />
          <DropdownMenuLabel :class="MENU_SECTION_LABEL_CLASS">
            {{ $t("view.view_as") }}
          </DropdownMenuLabel>
          <DropdownMenuRadioGroup
            :model-value="viewMode"
            @update:model-value="selectViewMode"
          >
            <DropdownMenuRadioItem
              v-for="view in VIEW_MODES"
              :key="view.value"
              :value="view.value"
              class="gap-3"
            >
              <template #indicator-icon>
                <Check class="size-3.5" />
              </template>
              <component :is="view.icon" class="size-4" />
              <span class="min-w-0 flex-1 truncate">{{ $t(view.label) }}</span>
            </DropdownMenuRadioItem>
          </DropdownMenuRadioGroup>
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
import {
  ArrowDown,
  ArrowUp,
  ArrowUpDown,
  Check,
  ChevronDown,
} from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  // menu: an icon that opens the sort menu; button: the current sort, opening
  // the menu; chips: the quick sorts
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
const {
  current,
  selectedOption,
  quickOptions,
  sortByOption,
  sortByDirection,
  sortByQuickOption,
} = sorting;

const sortOptionLabel = (option: SortOptionInfo) =>
  t(`sort.${option.label_key ?? option.field}`);

const selectSortOption = (field: unknown) => {
  if (typeof field !== "string") return;
  const option = props.options.find((item) => item.field === field);
  if (option) emit("sort-by", sortByOption(option));
};

const selectSortDirection = (direction: unknown) => {
  if (!selectedOption.value?.supports_direction) return;
  if (direction === SortDirection.ASC || direction === SortDirection.DESC) {
    const nextSortBy = sortByDirection(direction);
    if (nextSortBy) emit("sort-by", nextSortBy);
  }
};

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

const selectViewMode = (value: unknown) => {
  const mode = VIEW_MODES.find((item) => item.value === value);
  if (mode) emit("view-mode", mode.value);
};

const quickSortDirection = (option: SortOptionInfo) =>
  current.value.field === option.field
    ? current.value.direction
    : (option.default_direction ?? SortDirection.ASC);

const quickSortAriaLabel = (option: SortOptionInfo) =>
  `${sortOptionLabel(option)}, ${sortDirectionLabel(quickSortDirection(option))}`;

const changeQuickSort = (option: SortOptionInfo) =>
  emit("sort-by", sortByQuickOption(option));
</script>
