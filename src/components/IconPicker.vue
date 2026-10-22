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
    item-title="title"
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
      <v-list-item
        v-bind="itemProps"
        :title="item.raw.title"
        :subtitle="item.raw.value"
      >
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
import { getLucideIcon, PLAYER_ICON_OPTIONS } from "@/helpers/icon";
import { computed, ref } from "vue";

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

const searchQuery = ref("");

// The picker only offers the canonical ids of the shared icon set. With no
// query, all icons are listed in manifest (category) order; a query ranks
// them by id, display name and keywords.
const filteredItems = computed(() => {
  const q = searchQuery.value?.trim().toLowerCase() ?? "";

  const options = PLAYER_ICON_OPTIONS.map((o) => ({
    value: o.id,
    title: o.name,
    option: o,
  }));
  if (!q) return options;

  const ranked = options
    .flatMap((item) => {
      const { id, name, keywords } = item.option;
      const idParts = id.split("-");
      let rank: number;
      if (idParts.includes(q)) {
        rank = 1;
      } else if (id.startsWith(q) || name.toLowerCase().startsWith(q)) {
        rank = 2;
      } else if (idParts.some((p) => p.startsWith(q))) {
        rank = 3;
      } else if (
        id.includes(q) ||
        name.toLowerCase().includes(q) ||
        keywords.some((k) => k.includes(q))
      ) {
        rank = 4;
      } else {
        return [];
      }
      return [{ rank, item }];
    })
    .sort((a, b) => a.rank - b.rank)
    .map((e) => e.item);

  if (!ranked.length && q === props.modelValue?.toLowerCase()) return options;
  return ranked;
});

const onSelect = (value: string | null) => {
  emit("update:modelValue", value || null);
};
</script>
