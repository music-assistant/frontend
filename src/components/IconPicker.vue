<template>
  <v-autocomplete
    v-model:search="searchQuery"
    :model-value="modelValue"
    :items="filteredItems"
    :label="label"
    :placeholder="placeholder"
    :disabled="disabled"
    :no-filter="true"
    item-value="value"
    item-title="value"
    variant="outlined"
    density="comfortable"
    clearable
    auto-select-first
    @update:model-value="onSelect"
    @click:clear="emit('click:clear')"
  >
    <!-- icon preview in the input field -->
    <template #prepend-inner>
      <component
        :is="getLucideIcon(modelValue)"
        v-if="modelValue && getLucideIcon(modelValue)"
        :size="20"
        class="mr-2"
      />
    </template>

    <!-- icon list items -->
    <template #item="{ item, props: itemProps }">
      <v-list-item v-bind="itemProps" :title="item.raw.value">
        <template #prepend>
          <component
            :is="getLucideIcon(item.raw.value)"
            :size="22"
            class="mr-3"
          />
        </template>
      </v-list-item>
    </template>
  </v-autocomplete>
</template>

<script setup lang="ts">
import {
  getLucideIcon,
  getLucideIconNames,
  MA_ICON_NAMES,
  SUGGESTED_ICON_NAMES,
} from "@/helpers/icon";
import { computed, onMounted, ref } from "vue";

const lucideIconNames = ref<readonly string[]>([]);
onMounted(() => {
  getLucideIconNames().then((names) => {
    lucideIconNames.value = names;
  });
});

const props = defineProps<{
  modelValue: string | null | undefined;
  label?: string;
  placeholder?: string;
  disabled?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:modelValue", value: string | null): void;
  (e: "click:clear"): void;
}>();

const MAX_ITEMS = 100;
const searchQuery = ref("");

// When no query: show curated suggestions only.
// Otherwise: rank across all MA + Lucide icons, boost suggested ones.
const filteredItems = computed(() => {
  const q = searchQuery.value?.trim().toLowerCase() ?? "";

  if (!q) {
    return SUGGESTED_ICON_NAMES.map((name) => ({ value: name }));
  }

  const suggestedSet = new Set(SUGGESTED_ICON_NAMES);
  const ranked: { rank: number; name: string }[] = [];

  // MA icons searched first so they appear at the top when matched
  for (const name of [...MA_ICON_NAMES, ...lucideIconNames.value]) {
    const parts = name.split("-");
    let rank: number;

    if (parts.includes(q)) {
      rank = 1;
    } else if (name.startsWith(q)) {
      rank = 2;
    } else if (parts.some((p) => p.startsWith(q))) {
      rank = 3;
    } else if (name.includes(q)) {
      rank = 4;
    } else {
      continue;
    }

    // Suggested icons sort before non-suggested within the same rank
    if (suggestedSet.has(name)) rank -= 0.5;

    ranked.push({ rank, name });
    if (ranked.length >= MAX_ITEMS * 2) break;
  }

  return ranked
    .sort((a, b) => a.rank - b.rank)
    .slice(0, MAX_ITEMS)
    .map((e) => ({ value: e.name }));
});

const onSelect = (value: string | null) => {
  emit("update:modelValue", value || null);
};
</script>
