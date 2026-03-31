<template>
  <th
    class="hidden h-10 cursor-pointer select-none px-6 text-right align-middle font-medium text-muted-foreground hover:text-foreground sm:table-cell"
    tabindex="0"
    @click="emit('sort')"
    @keydown.enter.space.prevent="emit('sort')"
  >
    <span class="inline-flex items-center justify-end gap-1">
      {{ label }}
      <ChevronUp v-if="active && dir === 'asc'" class="size-3.5" />
      <ChevronDown v-else-if="active && dir === 'desc'" class="size-3.5" />
      <ChevronsUpDown v-else class="size-3.5 opacity-40" />
    </span>
  </th>
</template>

<script setup lang="ts">
import { ChevronDown, ChevronUp, ChevronsUpDown } from "lucide-vue-next";

interface Props {
  label: string;
  active: boolean;
  dir: "asc" | "desc";
}

defineProps<Props>();
const emit = defineEmits<{ sort: [] }>();
</script>
