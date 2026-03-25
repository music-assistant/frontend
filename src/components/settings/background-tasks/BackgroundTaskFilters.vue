<template>
  <div class="filters-container">
    <InputGroup class="search-field">
      <InputGroupInput v-model="searchQuery" :placeholder="$t('search')" />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
  </div>
</template>

<script setup lang="ts">
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { Search } from "lucide-vue-next";
import { onBeforeUnmount, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();

const searchQuery = ref<string>("");
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

const emit = defineEmits<{
  (e: "update:search", value: string): void;
}>();

if (route.query.search) {
  searchQuery.value = route.query.search as string;
}

watch(
  searchQuery,
  (newQuery) => {
    emit("update:search", newQuery);

    if (searchDebounceTimeout) {
      clearTimeout(searchDebounceTimeout);
    }
    searchDebounceTimeout = setTimeout(() => {
      const currentSearch = Array.isArray(route.query.search)
        ? route.query.search[0] || ""
        : (route.query.search as string | undefined) || "";
      if (currentSearch === newQuery) {
        return;
      }
      const query = { ...route.query };
      if (newQuery) {
        query.search = newQuery;
      } else {
        delete query.search;
      }
      router.replace({ query });
    }, 750);
  },
  { immediate: true },
);

onBeforeUnmount(() => {
  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout);
  }
});
</script>

<style scoped>
.filters-container {
  display: flex;
  align-items: stretch;
  gap: 12px;
  flex: 1;
  flex-wrap: wrap;
}

.search-field {
  flex: 1 1 auto;
  min-width: 250px;
  max-width: 400px;
}

@media (max-width: 960px) {
  .filters-container {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field {
    width: 100%;
    min-width: 100%;
    max-width: none;
  }
}
</style>
