<template>
  <div v-if="mode === 'menu'" class="flex min-w-0 items-center gap-1">
    <DropdownMenu>
      <DropdownMenuTrigger as-child>
        <Button
          variant="ghost"
          size="icon-lg"
          :title="$t('tooltip.sort_options')"
          :aria-label="$t('tooltip.sort_options')"
          :disabled="disabled || !options.length"
        >
          <ArrowUpDown class="size-[22px]" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" class="min-w-56">
        <DropdownMenuRadioGroup
          :model-value="current.field"
          @update:model-value="selectSortOption"
        >
          <DropdownMenuRadioItem
            v-for="option in options"
            :key="option.field"
            :value="option.field"
            class="gap-3"
            :disabled="disabled"
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
          <DropdownMenuRadioGroup
            :model-value="current.direction"
            @update:model-value="selectSortDirection"
          >
            <DropdownMenuRadioItem
              :value="SortDirection.ASC"
              class="gap-3"
              :disabled="disabled"
            >
              <template #indicator-icon>
                <Check class="size-3.5" />
              </template>
              <ArrowUp class="size-4" />
              <span class="min-w-0 flex-1 truncate">{{
                $t("sort.ascending")
              }}</span>
            </DropdownMenuRadioItem>
            <DropdownMenuRadioItem
              :value="SortDirection.DESC"
              class="gap-3"
              :disabled="disabled"
            >
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
    v-else-if="!mobileLayout && quickOptions.length"
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
      :disabled="disabled"
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
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { SortDirection, type SortOptionInfo } from "@/plugins/api/interfaces";
import { useLibrarySorting } from "@/composables/useLibrarySorting";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  mode: "menu" | "chips";
  options: SortOptionInfo[];
  sortBy: string;
  disabled?: boolean;
  mobileLayout?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  mobileLayout: false,
});

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
  quickOptions,
  sortByOption,
  sortByDirection,
  sortByQuickOption,
} = sorting;

const selectedOption = computed(() =>
  props.options.find((option) => option.field === current.value.field),
);

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

const quickSortDirection = (option: SortOptionInfo) =>
  current.value.field === option.field
    ? current.value.direction
    : (option.default_direction ?? SortDirection.ASC);

const quickSortAriaLabel = (option: SortOptionInfo) =>
  `${sortOptionLabel(option)}, ${sortDirectionLabel(quickSortDirection(option))}`;

const changeQuickSort = (option: SortOptionInfo) =>
  emit("sort-by", sortByQuickOption(option));
</script>
