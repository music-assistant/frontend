<template>
  <div v-if="mode !== 'chips'" class="flex min-w-0 items-center gap-1">
    <DropdownMenu>
      <!-- the field opens the menu, and the arrow beside it flips the order -->
      <ButtonGroup v-if="mode === 'split'" class="w-46">
        <DropdownMenuTrigger as-child>
          <Button
            variant="outline"
            class="min-w-0 flex-1 justify-start gap-2 px-3"
            :aria-label="$t('sort.sort_by_current', [currentLabel])"
            :disabled="!options.length"
          >
            <ArrowUpDown class="text-muted-foreground" />
            <span class="min-w-0 flex-1 truncate text-left">
              {{ currentLabel }}
            </span>
            <ChevronDown class="text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <Button
          variant="outline"
          size="icon"
          :title="directionToggleLabel"
          :aria-label="directionToggleLabel"
          :disabled="!selectedOption?.supports_direction"
          @click="flipSortDirection"
        >
          <ArrowDown v-if="current.direction === SortDirection.DESC" />
          <ArrowUp v-else />
        </Button>
      </ButtonGroup>
      <DropdownMenuTrigger v-else as-child>
        <Button
          variant="ghost"
          size="icon-lg"
          :title="$t('tooltip.sort_options')"
          :aria-label="$t('tooltip.sort_options')"
          :disabled="!options.length"
        >
          <ArrowUpDown class="size-[22px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="min-w-56">
        <DropdownMenuLabel
          v-if="mode === 'split'"
          class="text-xs text-muted-foreground uppercase"
        >
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
          <DropdownMenuLabel
            v-if="mode === 'split'"
            class="text-xs text-muted-foreground uppercase"
          >
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
import { Button } from "@/components/ui/button";
import { ButtonGroup } from "@/components/ui/button-group";
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
  // menu: an icon that opens the sort menu; split: the current sort opening
  // the menu, beside a button that flips its order; chips: the quick sorts
  mode: "menu" | "split" | "chips";
  options: SortOptionInfo[];
  sortBy: string;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  "sort-by": [value: string];
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

const oppositeDirection = (direction: SortDirection) =>
  direction === SortDirection.ASC ? SortDirection.DESC : SortDirection.ASC;

const currentLabel = computed(() =>
  selectedOption.value ? sortOptionLabel(selectedOption.value) : "",
);

const directionToggleLabel = computed(() =>
  t("sort.switch_direction", [
    sortDirectionLabel(current.value.direction),
    sortDirectionLabel(oppositeDirection(current.value.direction)),
  ]),
);

const flipSortDirection = () =>
  selectSortDirection(oppositeDirection(current.value.direction));

const quickSortDirection = (option: SortOptionInfo) =>
  current.value.field === option.field
    ? current.value.direction
    : (option.default_direction ?? SortDirection.ASC);

const quickSortAriaLabel = (option: SortOptionInfo) =>
  `${sortOptionLabel(option)}, ${sortDirectionLabel(quickSortDirection(option))}`;

const changeQuickSort = (option: SortOptionInfo) =>
  emit("sort-by", sortByQuickOption(option));
</script>
