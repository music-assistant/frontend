<template>
  <v-autocomplete
    v-model:search="searchQuery"
    :model-value="modelValue"
    :items="filteredItems"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :prepend-inner-icon="(modelValue as string) || undefined"
    :no-filter="true"
    item-value="value"
    item-title="value"
    variant="outlined"
    density="comfortable"
    clearable
    auto-select-first
    @update:model-value="onSelect"
    @click:clear="$emit('update:modelValue', null)"
  >
    <template #item="{ item, props: itemProps }">
      <v-list-item v-bind="itemProps" :title="item.raw.value">
        <template #prepend>
          <v-icon class="mr-3">{{ item.raw.value }}</v-icon>
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import { MDI_ICON_NAMES } from "@/helpers/mdi-icon-names";
import { computed, ref } from "vue";

const props = defineProps<{
  modelValue: string | null | undefined;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string | null): void;
}>();

const MAX_ITEMS = 100;
const searchQuery = ref("");

// Ranking (matches HA's ha-icon-picker logic):
//   1 – exact word in icon name parts
//   2 – exact keyword match
//   3 – icon name starts with query
//   4 – icon name contains query
//   5 – keyword contains query
const filteredItems = computed(() => {
  const q = searchQuery.value?.trim().toLowerCase().replace(/^mdi-/, "") ?? "";

  if (!q) {
    return MDI_ICON_NAMES.slice(0, MAX_ITEMS).map((e) => ({
      value: `mdi-${e.name}`,
    }));
  }

  const ranked: { rank: number; name: string }[] = [];

  for (const entry of MDI_ICON_NAMES) {
    const { name, keywords = [] } = entry;
    const parts = name.split("-");
    let rank: number;

    if (parts.includes(q)) {
      rank = 1;
    } else if (keywords.includes(q)) {
      rank = 2;
    } else if (name.startsWith(q)) {
      rank = 3;
    } else if (name.includes(q)) {
      rank = 4;
    } else if (keywords.some((kw) => kw.includes(q))) {
      rank = 5;
    } else {
      continue;
    }

    ranked.push({ rank, name });
    if (ranked.length >= MAX_ITEMS * 2) break; // gather extra for stable sort
  }

  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_ITEMS)
    .map((e) => ({ value: `mdi-${e.name}` }));
});

const onSelect = (value: string | null) => {
  emit("update:modelValue", value || null);
};
</script>
