<template>
  <div
    class="flex flex-wrap items-center justify-between gap-3 border-b px-6 py-3"
  >
    <div
      class="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center sm:gap-3"
    >
      <div class="relative w-full sm:max-w-xs">
        <Search
          class="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-muted-foreground"
        />
        <Input
          v-model="search"
          :placeholder="$t('search')"
          class="w-full pl-9"
        />
      </div>
      <NativeSelect v-if="filterOptions?.length" v-model="filter">
        <option
          v-for="opt in filterOptions"
          :key="opt.value"
          :value="opt.value"
        >
          {{ opt.label }}
        </option>
      </NativeSelect>
    </div>
    <div class="hidden shrink-0 items-center gap-2 sm:flex">
      <span class="text-sm text-muted-foreground">{{ rowsPerPageLabel }}</span>
      <NativeSelect v-model="rowsPerPage" class="w-20">
        <option v-for="opt in pageSizeOptions" :key="opt" :value="opt">
          {{ opt }}
        </option>
      </NativeSelect>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Search } from "lucide-vue-next";

import { Input } from "@/components/ui/input";
import { NativeSelect } from "@/components/ui/native-select";

interface FilterOption {
  value: string;
  label: string;
}

interface Props {
  filterOptions?: FilterOption[];
  rowsPerPageLabel: string;
  pageSizeOptions?: string[];
}

withDefaults(defineProps<Props>(), {
  pageSizeOptions: () => ["10", "25", "50"],
});

const search = defineModel<string>("search", { default: "" });
const filter = defineModel<string>("filter", { default: "" });
const rowsPerPage = defineModel<string>("rowsPerPage", { default: "25" });
</script>
