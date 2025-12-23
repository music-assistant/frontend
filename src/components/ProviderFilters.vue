<template>
  <div class="filters-container">
    <InputGroup class="search-field">
      <InputGroupInput v-model="searchQuery" :placeholder="$t('search')" />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
    <div class="filter-buttons">
      <FacetedFilter
        v-model="selectedProviderTypes"
        :title="$t('settings.provider_type')"
        :options="providerTypeOptions"
      />
      <FacetedFilter
        v-if="showStageFilter"
        v-model="selectedProviderStages"
        :title="$t('settings.stage.label')"
        :options="providerStageOptions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { ProviderStage, ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Search } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

// Props
const { showStageFilter = false } = defineProps<{
  showStageFilter?: boolean;
}>();

const router = useRouter();
const route = useRoute();

const searchQuery = ref<string>("");
const selectedProviderTypes = ref<string[]>([]);
const selectedProviderStages = ref<string[]>([]);
let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let typesDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let stagesDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

const providerTypeOptions = computed(() => [
  { label: $t("settings.musicprovider"), value: ProviderType.MUSIC },
  { label: $t("settings.playerprovider"), value: ProviderType.PLAYER },
  { label: $t("settings.metadataprovider"), value: ProviderType.METADATA },
  { label: $t("settings.pluginprovider"), value: ProviderType.PLUGIN },
]);

const providerStageOptions = computed(() => [
  { label: $t("settings.stage.options.stable"), value: ProviderStage.STABLE },
  { label: $t("settings.stage.options.beta"), value: ProviderStage.BETA },
  { label: $t("settings.stage.options.alpha"), value: ProviderStage.ALPHA },
  {
    label: $t("settings.stage.options.experimental"),
    value: ProviderStage.EXPERIMENTAL,
  },
  {
    label: $t("settings.stage.options.unmaintained"),
    value: ProviderStage.UNMAINTAINED,
  },
  {
    label: $t("settings.stage.options.deprecated"),
    value: ProviderStage.DEPRECATED,
  },
]);

// Emits
const emit = defineEmits<{
  (e: "update:search", value: string): void;
  (e: "update:types", value: string[]): void;
  (e: "update:stages", value: string[]): void;
}>();

const initializeFromUrl = function () {
  if (route.query.search) {
    searchQuery.value = route.query.search as string;
  }

  if (route.query.types) {
    const types = route.query.types as string;
    selectedProviderTypes.value = types.split(",");
  }

  if (route.query.stages) {
    const stages = route.query.stages as string;
    selectedProviderStages.value = stages.split(",");
  }
};

// Watch search query and update URL with debounce
watch(searchQuery, (newQuery) => {
  emit("update:search", newQuery);

  if (searchDebounceTimeout) {
    clearTimeout(searchDebounceTimeout);
  }
  searchDebounceTimeout = setTimeout(() => {
    const query = { ...route.query };
    if (newQuery) {
      query.search = newQuery;
    } else {
      delete query.search;
    }
    router.replace({ query });
  }, 750);
});

// Watch selected provider types and update URL with debounce
watch(
  selectedProviderTypes,
  (newTypes) => {
    emit("update:types", newTypes);

    if (typesDebounceTimeout) {
      clearTimeout(typesDebounceTimeout);
    }
    typesDebounceTimeout = setTimeout(() => {
      const query = { ...route.query };
      if (newTypes.length > 0) {
        query.types = newTypes.join(",");
      } else {
        delete query.types;
      }
      router.replace({ query });
    }, 750);
  },
  { deep: true },
);

// Watch selected provider stages and update URL with debounce
watch(
  selectedProviderStages,
  (newStages) => {
    emit("update:stages", newStages);

    if (stagesDebounceTimeout) {
      clearTimeout(stagesDebounceTimeout);
    }
    stagesDebounceTimeout = setTimeout(() => {
      const query = { ...route.query };
      if (newStages.length > 0) {
        query.stages = newStages.join(",");
      } else {
        delete query.stages;
      }
      router.replace({ query });
    }, 750);
  },
  { deep: true },
);

initializeFromUrl();
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

.filter-buttons {
  display: flex;
  gap: 8px;
  flex-shrink: 0;
  flex-wrap: wrap;
}

/* Mobile responsive */
@media (max-width: 960px) {
  .filters-container {
    flex-direction: column;
    align-items: stretch;
  }

  .search-field {
    width: 100%;
    min-width: 100%;
  }

  .filter-buttons {
    width: 100%;
  }
}
</style>
