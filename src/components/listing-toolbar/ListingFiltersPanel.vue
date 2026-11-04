<template>
  <section class="flex flex-col gap-4" :aria-labelledby="titleId">
    <div class="flex items-center justify-between">
      <h2 :id="titleId" class="text-base font-semibold">
        {{ $t("listing_filters.title") }}
      </h2>
      <Button
        v-if="hasActiveFilters"
        variant="link"
        size="sm"
        class="h-8 px-2"
        @click="emit('clear')"
      >
        {{ $t("listing_filters.clear_all") }}
      </Button>
    </div>

    <div v-if="toggles.length" class="flex flex-col gap-1">
      <div
        v-for="filter in toggles"
        :key="filter.id"
        class="flex h-10 items-center justify-between gap-3"
      >
        <Label :for="controlId(filter.id)" class="gap-2.5 font-normal">
          <component :is="filter.icon" class="size-4 text-muted-foreground" />
          {{ filter.label }}
        </Label>
        <Switch
          :id="controlId(filter.id)"
          :model-value="filter.active"
          @update:model-value="filter.toggle()"
        />
      </div>
    </div>

    <Separator v-if="toggles.length && fields.length" />

    <template v-for="filter in fields" :key="filter.id">
      <ListingMultiFilterField
        v-if="filter.kind === 'multi'"
        :filter="filter"
      />
      <div v-else class="flex flex-col gap-2">
        <span :id="controlId(filter.id)" :class="SECTION_LABEL_CLASS">
          {{ filter.label }}
        </span>
        <RadioGroup
          :model-value="filter.selected"
          :aria-labelledby="controlId(filter.id)"
          class="gap-0.5"
          @update:model-value="(value) => filter.select(String(value))"
        >
          <Label
            v-for="option in filter.options"
            :key="option.value"
            class="h-9 cursor-pointer gap-2.5 rounded-md px-1 font-normal hover:bg-accent/50"
          >
            <RadioGroupItem :value="option.value" />
            {{ option.label }}
          </Label>
        </RadioGroup>
      </div>
    </template>
  </section>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import type {
  ListingChoiceFilter,
  ListingFilter,
  ListingMultiFilter,
  ListingToggleFilter,
} from "@/helpers/listing_filters";
import { computed, useId } from "vue";
import ListingMultiFilterField from "./ListingMultiFilterField.vue";
import { SECTION_LABEL_CLASS } from "./constants";

const props = defineProps<{
  filters: ListingFilter[];
  hasActiveFilters: boolean;
}>();

const emit = defineEmits<{
  clear: [];
}>();

const titleId = useId();
const controlId = (filterId: string) => `${titleId}-${filterId}`;

// the on/off filters sit together at the top, the ones with values below
const toggles = computed(() =>
  props.filters.filter(
    (filter): filter is ListingToggleFilter => filter.kind === "toggle",
  ),
);
const fields = computed(() =>
  props.filters.filter(
    (filter): filter is ListingMultiFilter | ListingChoiceFilter =>
      filter.kind !== "toggle",
  ),
);
</script>
