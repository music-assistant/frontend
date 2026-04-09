<template>
  <Popover>
    <PopoverTrigger as-child>
      <Button variant="outline" class="border-dashed">
        <PlusCircle class="h-4 w-4" />
        {{ title }}
        <template v-if="selectedCount > 0">
          <Separator orientation="vertical" class="mx-2 h-4" />
          <Badge class="lg:hidden font-medium rounded-[6px]" :aria-label="`${selectedCount} selected`">
            {{ selectedCount }}
          </Badge>
          <div class="hidden space-x-1 lg:flex">
            <Badge v-if="selectedCount > 2" class="rounded-[6px] gap-2">
              {{ selectedCount }} selected
              <button
                type="button"
                :aria-label="`Clear all ${title} filters`"
                class="flex items-center justify-center cursor-pointer hover:opacity-70"
                @click.stop="clear"
              >
                <X class="size-2.5" />
              </button>
            </Badge>
            <template v-else>
              <Badge
                v-for="opt in selectedOptionLabels"
                :key="opt.value"
                class="font-medium rounded-[6px] gap-2"
              >
                {{ opt.label }}
                <button
                  type="button"
                  :aria-label="`Remove ${opt.label} filter`"
                  class="flex items-center justify-center cursor-pointer hover:opacity-70"
                  @click.stop="removeFilter(opt.value)"
                >
                  <X class="size-2.5" />
                </button>
              </Badge>
            </template>
          </div>
        </template>
      </Button>
    </PopoverTrigger>
    <PopoverContent class="w-[220px] p-0" align="start">
      <div class="faceted-filter-content">
        <Input v-model="search" :placeholder="title" :aria-label="`Search ${title}`" class="mb-2 h-8" />
        <div class="faceted-filter-list">
          <div
            v-for="option in filteredOptions"
            :key="option.value"
            class="faceted-filter-item"
            role="checkbox"
            :aria-checked="selectedSet.has(option.value)"
            tabindex="0"
            @click="toggle(option.value)"
            @keydown.space.prevent="toggle(option.value)"
          >
            <Checkbox
              :model-value="selectedSet.has(option.value)"
              class="mr-2 pointer-events-none"
              tabindex="-1"
              aria-hidden="true"
            />
            <span class="truncate">
              {{ option.label }}
            </span>
          </div>
        </div>
        <button
          v-if="selectedCount > 0"
          type="button"
          class="faceted-filter-clear"
          :aria-label="`Clear ${title} filters`"
          @click="clear"
        >
          Clear filters
        </button>
      </div>
    </PopoverContent>
  </Popover>
</template>

<script setup lang="ts">
import { PlusCircle, X } from "lucide-vue-next";
import type { HTMLAttributes } from "vue";
import { computed, ref } from "vue";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Separator } from "@/components/ui/separator";

interface FacetedOption {
  label: string;
  value: string;
}

const props = defineProps<{
  title: string;
  options: FacetedOption[];
  modelValue: string[];
  class?: HTMLAttributes["class"];
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string[]): void;
}>();

const search = ref("");

const selectedSet = computed(() => new Set(props.modelValue || []));

const selectedCount = computed(() => selectedSet.value.size);

const selectedOptionLabels = computed(() =>
  props.options.filter((opt) => selectedSet.value.has(opt.value)),
);

const filteredOptions = computed(() => {
  const term = search.value.toLowerCase().trim();
  if (!term) return props.options;
  return props.options.filter((opt) => opt.label.toLowerCase().includes(term));
});

const toggle = (value: string) => {
  const next = new Set(selectedSet.value);
  if (next.has(value)) {
    next.delete(value);
  } else {
    next.add(value);
  }
  emit("update:modelValue", Array.from(next));
};

const removeFilter = (value: string) => {
  const next = new Set(selectedSet.value);
  next.delete(value);
  emit("update:modelValue", Array.from(next));
};

const clear = () => {
  emit("update:modelValue", []);
};
</script>

<style scoped>
.faceted-filter-content {
  padding: 8px 10px 10px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.faceted-filter-list {
  max-height: 260px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.faceted-filter-item {
  display: flex;
  align-items: center;
  gap: 8px;
  width: 100%;
  padding: 4px 6px;
  border-radius: 4px;
  background: transparent;
  border: none;
  cursor: pointer;
  text-align: left;
}

.faceted-filter-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}

.faceted-filter-clear {
  margin-top: 4px;
  width: 100%;
  padding: 4px 6px;
  font-size: 0.8rem;
  border-radius: 4px;
  border: none;
  background: transparent;
  color: rgba(var(--v-theme-on-surface), 0.7);
  cursor: pointer;
}

.faceted-filter-clear:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
