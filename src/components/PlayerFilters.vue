<template>
  <div class="filters-container">
    <InputGroup class="search-field">
      <InputGroupInput v-model="searchQuery" :placeholder="$t('search')" />
      <InputGroupAddon>
        <Search />
      </InputGroupAddon>
    </InputGroup>
    <div class="d-flex ga-2 filter-buttons">
      <FacetedFilter
        v-model="selectedProviders"
        :title="$t('settings.player_provider')"
        :options="providerOptions"
      />
      <FacetedFilter
        v-model="selectedPlayerTypes"
        :title="$t('settings.player_type_label')"
        :options="playerTypeOptions"
      />
    </div>
  </div>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  InputGroup,
  InputGroupAddon,
  InputGroupInput,
} from "@/components/ui/input-group";
import { api } from "@/plugins/api";
import { PlayerType, ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { Search } from "lucide-vue-next";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();

const searchQuery = ref<string>("");
const selectedProviders = ref<string[]>([]);
const selectedPlayerTypes = ref<string[]>([]);

let searchDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let providersDebounceTimeout: ReturnType<typeof setTimeout> | null = null;
let typesDebounceTimeout: ReturnType<typeof setTimeout> | null = null;

const availableProviders = computed(() => {
  const providers = Object.values(api.providers)
    .filter((x) => x.available && x.type === ProviderType.PLAYER)
    .map((x) => ({
      instance_id: x.instance_id,
      domain: x.domain,
      name: x.name || api.providerManifests[x.domain]?.name || x.domain,
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
  return providers;
});

const playerTypes = computed(() => [
  { title: $t("player_type.player"), value: PlayerType.PLAYER },
  { title: $t("player_type.group"), value: PlayerType.GROUP },
  { title: $t("player_type.stereo_pair"), value: PlayerType.STEREO_PAIR },
]);

const providerOptions = computed(() =>
  availableProviders.value.map((p) => ({
    label: p.name,
    value: p.instance_id,
    icon: ProviderIcon,
    domain: p.domain,
  })),
);

const playerTypeOptions = computed(() =>
  playerTypes.value.map((p) => ({
    label: p.title,
    value: p.value,
  })),
);

// Emits
const emit = defineEmits<{
  (e: "update:search", value: string): void;
  (e: "update:providers", value: string[]): void;
  (e: "update:types", value: string[]): void;
}>();

const toggleProvider = function (provider: string) {
  const index = selectedProviders.value.indexOf(provider);
  if (index > -1) {
    selectedProviders.value.splice(index, 1);
  } else {
    selectedProviders.value.push(provider);
  }
};

const togglePlayerType = function (type: string) {
  const index = selectedPlayerTypes.value.indexOf(type);
  if (index > -1) {
    selectedPlayerTypes.value.splice(index, 1);
  } else {
    selectedPlayerTypes.value.push(type);
  }
};

const initializeFromUrl = function () {
  if (route.query.search) {
    searchQuery.value = route.query.search as string;
  }

  if (route.query.providers) {
    const providers = route.query.providers as string;
    selectedProviders.value = providers.split(",");
  }

  if (route.query.types) {
    const types = route.query.types as string;
    selectedPlayerTypes.value = types.split(",");
  }
};

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

watch(
  selectedProviders,
  (newProviders) => {
    emit("update:providers", newProviders);

    if (providersDebounceTimeout) {
      clearTimeout(providersDebounceTimeout);
    }
    providersDebounceTimeout = setTimeout(() => {
      const query = { ...route.query };
      if (newProviders.length > 0) {
        query.providers = newProviders.join(",");
      } else {
        delete query.providers;
      }
      router.replace({ query });
    }, 750);
  },
  { deep: true },
);

watch(
  selectedPlayerTypes,
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

.filter-buttons .v-btn {
  min-width: 100px;
  border-color: rgba(var(--v-theme-on-surface), 0.2);
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.filter-buttons .v-btn .v-icon {
  color: rgba(var(--v-theme-on-surface), 0.6);
}

.filter-btn {
  position: relative;
}

.filter-dot {
  position: absolute;
  top: 6px;
  right: 6px;
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background-color: rgb(var(--v-theme-primary));
  z-index: 1;
  box-shadow: 0 0 0 2px rgb(var(--v-theme-surface));
}

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

  .filter-buttons .v-btn {
    flex: 1 1 auto;
    min-width: 120px;
  }
}

:deep(.v-list-item .v-checkbox-btn) {
  display: flex;
  align-items: center;
}

:deep(.v-list-item .v-checkbox-btn .v-input__control) {
  display: flex;
  align-items: center;
}

:deep(.v-list-item .v-checkbox-btn .v-selection-control) {
  min-height: auto;
}

.provider-filter-list {
  max-height: 300px;
  overflow-y: auto;
}
</style>
