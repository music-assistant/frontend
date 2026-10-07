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
        <DropdownMenuItem
          v-for="option in options"
          :key="option.field"
          class="gap-3"
          :disabled="disabled"
          @select="emit('sort-option', option)"
        >
          <span class="min-w-0 flex-1 truncate">{{
            sortOptionLabel(option)
          }}</span>
          <Check v-if="selectedField === option.field" class="ml-auto size-4" />
        </DropdownMenuItem>
        <template v-if="selectedOption?.supports_direction">
          <DropdownMenuSeparator />
          <DropdownMenuItem
            class="gap-3"
            :disabled="disabled"
            @select="emit('sort-direction', SortDirection.ASC)"
          >
            <ArrowUp class="size-4" />
            <span class="min-w-0 flex-1 truncate">{{
              $t("sort.ascending")
            }}</span>
            <Check
              v-if="selectedDirection === SortDirection.ASC"
              class="ml-auto size-4"
            />
          </DropdownMenuItem>
          <DropdownMenuItem
            class="gap-3"
            :disabled="disabled"
            @select="emit('sort-direction', SortDirection.DESC)"
          >
            <ArrowDown class="size-4" />
            <span class="min-w-0 flex-1 truncate">{{
              $t("sort.descending")
            }}</span>
            <Check
              v-if="selectedDirection === SortDirection.DESC"
              class="ml-auto size-4"
            />
          </DropdownMenuItem>
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
          selectedField === option.field,
      }"
      :aria-pressed="selectedField === option.field"
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
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  SortDirection,
  SortField,
  type SortOptionInfo,
} from "@/plugins/api/interfaces";
import { ArrowDown, ArrowUp, ArrowUpDown, Check } from "@lucide/vue";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  mode: "menu" | "chips";
  options: SortOptionInfo[];
  selectedField: string;
  selectedDirection: SortDirection;
  disabled?: boolean;
  mobileLayout?: boolean;
}

const props = withDefaults(defineProps<Props>(), {
  disabled: false,
  mobileLayout: false,
});

const emit = defineEmits<{
  "sort-option": [option: SortOptionInfo];
  "sort-direction": [direction: SortDirection];
}>();

const { t } = useI18n();

const QUICK_SORT_FIELDS = [
  SortField.TIMESTAMP_ADDED,
  SortField.PLAY_COUNT,
  SortField.NAME,
];

const selectedOption = computed(() =>
  props.options.find((option) => option.field === props.selectedField),
);

const quickOptions = computed(() =>
  QUICK_SORT_FIELDS.flatMap((field) => {
    const option = props.options.find((item) => item.field === field);
    return option ? [option] : [];
  }),
);

const sortOptionLabel = (option: SortOptionInfo) =>
  t(`sort.${option.label_key ?? option.field}`);

const quickSortDirection = (option: SortOptionInfo) =>
  props.selectedField === option.field
    ? props.selectedDirection
    : (option.default_direction ?? SortDirection.ASC);

const quickSortAriaLabel = (option: SortOptionInfo) =>
  `${sortOptionLabel(option)}, ${t(`sort.${quickSortDirection(option)}`)}`;

const changeQuickSort = (option: SortOptionInfo) => {
  if (props.selectedField === option.field && option.supports_direction) {
    emit(
      "sort-direction",
      props.selectedDirection === SortDirection.DESC
        ? SortDirection.ASC
        : SortDirection.DESC,
    );
    return;
  }
  emit("sort-option", option);
};
</script>
