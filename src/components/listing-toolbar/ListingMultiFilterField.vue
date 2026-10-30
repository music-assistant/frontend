<template>
  <!-- a long list opens in its own searchable dropdown -->
  <div v-if="filter.layout === 'dropdown'" class="flex flex-col gap-2">
    <span :id="labelId" :class="SECTION_LABEL_CLASS">{{ filter.label }}</span>
    <FacetedFilter
      :title="filter.label"
      :options="filter.options"
      :model-value="filter.selected"
      @update:model-value="applySelection"
    >
      <template #trigger>
        <Button
          variant="outline"
          class="h-10 w-full justify-between font-normal"
          :aria-labelledby="`${labelId} ${summaryId}`"
        >
          <span :id="summaryId" class="min-w-0 truncate">{{ summary }}</span>
          <ChevronDown class="text-muted-foreground" />
        </Button>
      </template>
    </FacetedFilter>
  </div>

  <fieldset v-else class="m-0 flex min-w-0 flex-col gap-0.5 border-0 p-0">
    <legend :class="cn(SECTION_LABEL_CLASS, 'pb-2')">{{ filter.label }}</legend>
    <Label
      v-for="option in filter.options"
      :key="option.value"
      class="h-9 cursor-pointer gap-2.5 rounded-md px-1 font-normal hover:bg-accent/50"
    >
      <Checkbox
        :model-value="filter.selected.includes(option.value)"
        @update:model-value="filter.toggle(option.value)"
      />
      <ProviderIcon v-if="option.domain" :domain="option.domain" :size="20" />
      <span class="min-w-0 truncate">{{ option.label }}</span>
    </Label>
  </fieldset>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import type { ListingMultiFilter } from "@/helpers/listing_filters";
import { cn } from "@/lib/utils";
import { ChevronDown } from "@lucide/vue";
import { computed, useId } from "vue";
import { useI18n } from "vue-i18n";
import { SECTION_LABEL_CLASS } from "./constants";

// beyond this many picks the trigger counts them instead of naming them
const MAX_NAMED_PICKS = 2;

const props = defineProps<{
  filter: ListingMultiFilter;
}>();

const { t } = useI18n();
const labelId = useId();
const summaryId = useId();

const summary = computed(() => {
  const { options, selected, placeholder } = props.filter;
  if (!selected.length) return placeholder;
  if (selected.length > MAX_NAMED_PICKS) {
    return t("faceted_filter.selected", { count: selected.length });
  }
  return options
    .filter((option) => selected.includes(option.value))
    .map((option) => option.label)
    .join(", ");
});

// the dropdown hands back the whole selection, which a filter takes in one go
// where it can, and otherwise flips one value at a time
const applySelection = (next: string[]) => {
  const { selected, toggle, set } = props.filter;
  if (set) {
    set(next);
    return;
  }
  for (const value of selected) if (!next.includes(value)) toggle(value);
  for (const value of next) if (!selected.includes(value)) toggle(value);
};
</script>
