<template>
  <v-dialog
    :model-value="props.show"
    max-width="800px"
    scrollable
    @update:model-value="
      (v) => {
        store.dialogActive = v;
        emit('update:show', v);
      }
    "
  >
    <v-card class="add-provider-dialog">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">{{ $t("settings.add_provider") }}</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </v-card-title>

      <v-card-text class="pa-4 pb-2">
        <v-text-field
          ref="searchInput"
          v-model="searchQuery"
          prepend-inner-icon="mdi-magnify"
          :placeholder="$t('search')"
          variant="outlined"
          density="compact"
          clearable
          hide-details
          class="search-field"
        />
      </v-card-text>

      <v-card-text class="pa-4 pt-2 pb-2">
        <div class="d-flex ga-2 filter-buttons">
          <v-btn
            height="40"
            elevation="0"
            variant="outlined"
            density="compact"
            class="filter-btn"
          >
            {{ $t("settings.provider_type") }}
            <v-icon end>mdi-chevron-down</v-icon>
            <span v-if="hasActiveProviderTypes" class="filter-dot"></span>
            <v-menu activator="parent" :close-on-content-click="false">
              <v-list>
                <v-list-item
                  v-for="(providerType, index) in providerTypes"
                  :key="index"
                  :value="index"
                  @click="toggleProviderType(providerType.value)"
                >
                  <template #append>
                    <v-checkbox-btn
                      :model-value="
                        selectedProviderTypes.includes(providerType.value)
                      "
                      @click.stop="toggleProviderType(providerType.value)"
                    />
                  </template>
                  <v-list-item-title>
                    {{ providerType.title }}
                  </v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-btn>
          <v-btn
            height="40"
            elevation="0"
            variant="outlined"
            density="compact"
            class="filter-btn"
          >
            {{ $t("settings.stage.label") }}
            <v-icon end>mdi-chevron-down</v-icon>
            <span v-if="hasActiveProviderStages" class="filter-dot"></span>
            <v-menu activator="parent" :close-on-content-click="false">
              <v-list>
                <v-list-item
                  v-for="(stage, index) in providerStages"
                  :key="index"
                  :value="index"
                  @click="toggleProviderStage(stage.value)"
                >
                  <template #append>
                    <v-checkbox-btn
                      :model-value="
                        selectedProviderStages.includes(stage.value)
                      "
                      @click.stop="toggleProviderStage(stage.value)"
                    />
                  </template>
                  <v-list-item-title>{{ stage.title }}</v-list-item-title>
                </v-list-item>
              </v-list>
            </v-menu>
          </v-btn>
        </div>
      </v-card-text>

      <v-card-text class="pa-4 pt-2">
        <div class="provider-list-container">
          <v-list v-if="filteredProviders.length > 0" class="provider-list">
            <v-list-item
              v-for="provider in filteredProviders"
              :key="provider.domain"
              style="padding: 0"
              class="provider-item"
              rounded="lg"
              @click="addProvider(provider)"
            >
              <template #prepend>
                <provider-icon
                  :domain="provider.domain"
                  :size="40"
                  class="provider-icon"
                />
              </template>

              <template #title>
                <div class="provider-name">{{ provider.name }}</div>
              </template>

              <template #subtitle>
                <div class="provider-description">
                  {{ provider.description }}
                </div>
              </template>

              <template #append>
                <div class="d-flex align-center ga-2">
                  <v-chip
                    size="x-small"
                    variant="flat"
                    class="text-uppercase"
                    :color="getStageColor(provider.stage)"
                  >
                    {{ $t(String(provider.stage || "").toLowerCase()) }}
                  </v-chip>
                  <v-icon icon="mdi-chevron-right" size="small" />
                </div>
              </template>
            </v-list-item>
          </v-list>

          <div v-else class="empty-state">
            <v-icon icon="mdi-magnify" size="48" class="empty-icon" />
            <div class="empty-title">{{ $t("no_content") }}</div>
            <div class="empty-message">
              {{ $t("no_content_filter") }}
            </div>
          </div>
        </div>
      </v-card-text>
    </v-card>
  </v-dialog>
</template>

<script setup lang="ts">
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import {
  ProviderConfig,
  ProviderManifest,
  ProviderStage,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { match } from "ts-pattern";
import { computed, nextTick, ref, watch } from "vue";
import { useRouter } from "vue-router";

const props = defineProps<{
  show?: boolean;
  initialType?: string;
}>();

const POPULAR_PROVIDERS = [
  "spotify",
  "tidal",
  "qobuz",
  "filesystem_local",
  "filesystem_smb",
  "sonos",
  "chromecast",
  "airplay",
];

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const router = useRouter();
const providerConfigs = ref<ProviderConfig[]>([]);
const searchQuery = ref("");
const selectedProviderTypes = ref<string[]>([]);
const selectedProviderStages = ref<string[]>([]);
const searchInput = ref<HTMLInputElement | null>(null);

const providerTypes = computed(() => [
  { title: $t("settings.musicprovider"), value: ProviderType.MUSIC },
  { title: $t("settings.playerprovider"), value: ProviderType.PLAYER },
  { title: $t("settings.metadataprovider"), value: ProviderType.METADATA },
  { title: $t("settings.pluginprovider"), value: ProviderType.PLUGIN },
]);

const providerStages = computed(() => [
  { title: $t("settings.stage.options.stable"), value: ProviderStage.STABLE },
  { title: $t("settings.stage.options.beta"), value: ProviderStage.BETA },
  { title: $t("settings.stage.options.alpha"), value: ProviderStage.ALPHA },
  {
    title: $t("settings.stage.options.experimental"),
    value: ProviderStage.EXPERIMENTAL,
  },
  {
    title: $t("settings.stage.options.unmaintained"),
    value: ProviderStage.UNMAINTAINED,
  },
  {
    title: $t("settings.stage.options.deprecated"),
    value: ProviderStage.DEPRECATED,
  },
]);

const availableProviders = computed(() => {
  let providers = Object.values(api.providerManifests);

  providers = providers.filter(
    (x) => !x.builtin && x.type !== ("core" as ProviderType),
  );

  return providers
    .filter(
      (x) =>
        x.multi_instance ||
        !providerConfigs.value.find((y) => y.domain == x.domain),
    )
    .sort((a, b) => {
      const aPopularIndex = POPULAR_PROVIDERS.indexOf(a.domain);
      const bPopularIndex = POPULAR_PROVIDERS.indexOf(b.domain);
      const aIsPopular = aPopularIndex !== -1;
      const bIsPopular = bPopularIndex !== -1;

      if (aIsPopular && !bIsPopular) return -1;
      if (!aIsPopular && bIsPopular) return 1;
      if (aIsPopular && bIsPopular) return aPopularIndex - bPopularIndex;

      const nameA = (
        a.name || api.providerManifests[a.domain].name
      ).toUpperCase();
      const nameB = (
        b.name || api.providerManifests[b.domain].name
      ).toUpperCase();
      return nameA > nameB ? 1 : -1;
    });
});

const filteredProviders = computed(() => {
  let providers = availableProviders.value;

  if (searchQuery.value) {
    const query = searchQuery.value.toLowerCase();
    providers = providers.filter(
      (provider) =>
        provider.name.toLowerCase().includes(query) ||
        provider.description.toLowerCase().includes(query),
    );
  }

  if (selectedProviderTypes.value.length > 0) {
    providers = providers.filter((x) =>
      selectedProviderTypes.value.includes(x.type),
    );
  }

  if (selectedProviderStages.value.length > 0) {
    providers = providers.filter((x) =>
      selectedProviderStages.value.includes(x.stage),
    );
  }

  return providers;
});

const hasActiveProviderTypes = computed(
  () => selectedProviderTypes.value.length > 0,
);
const hasActiveProviderStages = computed(
  () => selectedProviderStages.value.length > 0,
);

const loadItems = async function () {
  providerConfigs.value = await api.getProviderConfigs();
};

const addProvider = function (provider: ProviderManifest) {
  if (provider.depends_on) {
    if (!api.getProvider(provider.depends_on)) {
      const depProvName = api.getProviderName(provider.depends_on);
      if (
        confirm(
          $t("settings.provider_depends_on_confirm", [
            provider.name,
            depProvName,
          ]),
        )
      ) {
        router.push(`/settings/addprovider/${provider.depends_on}`);
      }
      return;
    }
  }
  router.push(`/settings/addprovider/${provider.domain}`);
  close();
};

const toggleProviderType = function (type: string) {
  const index = selectedProviderTypes.value.indexOf(type);
  if (index > -1) {
    selectedProviderTypes.value.splice(index, 1);
  } else {
    selectedProviderTypes.value.push(type);
  }
};

const toggleProviderStage = function (stage: string) {
  const index = selectedProviderStages.value.indexOf(stage);
  if (index > -1) {
    selectedProviderStages.value.splice(index, 1);
  } else {
    selectedProviderStages.value.push(stage);
  }
};

const getStageColor = function (stage?: string) {
  return match(stage)
    .with("stable", () => "green")
    .with("beta", () => "blue")
    .with("alpha", () => "purple")
    .with("experimental", () => "orange")
    .with("unmaintained", () => "grey")
    .with("deprecated", () => "red")
    .otherwise(() => "green");
};

const close = function () {
  emit("update:show", false);
};

watch(
  () => api.providers,
  (val) => {
    if (val) loadItems();
  },
  { immediate: true },
);

watch(
  () => props.show,
  (isOpen) => {
    if (isOpen && props.initialType) {
      selectedProviderTypes.value = [props.initialType];
      searchQuery.value = "";
    } else if (!isOpen) {
      selectedProviderTypes.value = [];
      selectedProviderStages.value = [];
      searchQuery.value = "";
    }

    if (isOpen) {
      nextTick(() => {
        searchInput.value?.focus();
      });
    }
  },
);
</script>

<style scoped>
.add-provider-dialog {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.search-field {
  width: 100%;
}

.filter-buttons {
  flex-wrap: wrap;
}

.filter-buttons .v-btn {
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

.provider-list-container {
  height: 400px;
  display: flex;
  flex-direction: column;
}

.provider-list {
  flex: 1;
  overflow-y: auto;
}

.provider-item {
  height: 80px;
  margin-bottom: 4px;
  transition: all 0.2s ease;
  cursor: pointer;
}

.provider-item:hover {
  background-color: rgba(var(--v-theme-primary), 0.04);
  transform: translateY(-1px);
}

.provider-icon {
  margin-right: 12px;
}

.provider-name {
  font-weight: 500;
  font-size: 16px;
  line-height: 1.2;
  margin-bottom: 4px;
}

.provider-description {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.6);
  line-height: 1.3;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
  text-overflow: ellipsis;
  max-height: 2.6em;
}

.empty-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  height: 100%;
  text-align: center;
  padding: 40px 20px;
}

.empty-icon {
  color: rgba(var(--v-theme-on-surface), 0.3);
  margin-bottom: 16px;
}

.empty-title {
  font-size: 18px;
  font-weight: 500;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-bottom: 8px;
}

.empty-message {
  font-size: 14px;
  color: rgba(var(--v-theme-on-surface), 0.5);
  line-height: 1.4;
}

@media (max-width: 600px) {
  .add-provider-dialog {
    height: 500px;
  }

  .provider-list-container {
    height: 300px;
  }
}
</style>
