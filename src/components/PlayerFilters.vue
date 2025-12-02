<template>
  <div class="filters-container">
    <v-text-field
      v-model="searchQuery"
      prepend-inner-icon="mdi-magnify"
      :label="$t('search')"
      variant="outlined"
      density="compact"
      clearable
      hide-details
      class="search-field"
    />
    <div class="d-flex ga-2 filter-buttons">
      <v-btn height="40" elevation="0" variant="outlined" density="compact">
        {{ $t("settings.player_provider") }}
        <v-icon end>mdi-chevron-down</v-icon>
        <v-menu activator="parent" :close-on-content-click="false">
          <v-list class="provider-filter-list">
            <v-list-item
              v-for="provider in availableProviders"
              :key="provider.lookup_key"
              :value="provider.lookup_key"
              @click="toggleProvider(provider.lookup_key)"
            >
              <template #prepend>
                <provider-icon
                  :domain="provider.domain"
                  :size="26"
                  class="media-thumb"
                  style="margin-right: 12px"
                />
              </template>
              <template #append>
                <v-checkbox-btn
                  :model-value="selectedProviders.includes(provider.lookup_key)"
                  @click.stop="toggleProvider(provider.lookup_key)"
                />
              </template>
              <v-list-item-title>{{ provider.name }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-btn>
      <v-btn height="40" elevation="0" variant="outlined" density="compact">
        {{ $t("settings.player_type_label") }}
        <v-icon end>mdi-chevron-down</v-icon>
        <v-menu activator="parent" :close-on-content-click="false">
          <v-list>
            <v-list-item
              v-for="(playerType, index) in playerTypes"
              :key="index"
              :value="index"
              @click="togglePlayerType(playerType.value)"
            >
              <template #append>
                <v-checkbox-btn
                  :model-value="selectedPlayerTypes.includes(playerType.value)"
                  @click.stop="togglePlayerType(playerType.value)"
                />
              </template>
              <v-list-item-title>{{ playerType.title }}</v-list-item-title>
            </v-list-item>
          </v-list>
        </v-menu>
      </v-btn>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import { PlayerType, ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
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
      lookup_key: x.lookup_key,
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
