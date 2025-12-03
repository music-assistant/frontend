<template>
  <v-dialog
    :model-value="show"
    max-width="800px"
    scrollable
    @update:model-value="
      (v) => {
        store.dialogActive = v;
        emit('update:show', v);
      }
    "
  >
    <v-card class="add-player-group-dialog">
      <v-card-title class="d-flex align-center justify-space-between pa-4">
        <span class="text-h6">{{ $t("settings.add_group_player") }}</span>
        <v-btn icon="mdi-close" variant="text" size="small" @click="close" />
      </v-card-title>

      <v-card-text class="pa-4 pb-2">
        <v-text-field
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

      <v-card-text class="pa-4 pt-2">
        <div class="provider-list-container">
          <v-list v-if="filteredProviders.length > 0" class="provider-list">
            <v-list-item
              v-for="provider in filteredProviders"
              :key="provider.lookup_key"
              style="padding: 0"
              class="provider-item"
              rounded="lg"
              @click="addPlayerGroup(provider.lookup_key)"
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
                <v-icon icon="mdi-chevron-right" size="small" />
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
import { ProviderFeature } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

const { show = false } = defineProps<{
  show?: boolean;
}>();

const emit = defineEmits<{
  (e: "update:show", value: boolean): void;
}>();

const router = useRouter();
const searchQuery = ref("");

const availableProviders = computed(() => {
  return Object.values(api.providers)
    .filter(
      (x) =>
        x.available &&
        (x.supported_features.includes(ProviderFeature.CREATE_GROUP_PLAYER) ||
          x.supported_features.includes(ProviderFeature.SYNC_PLAYERS)),
    )
    .map((x) => ({
      lookup_key: x.lookup_key,
      domain: x.domain,
      name: x.name || api.providerManifests[x.domain]?.name || x.domain,
      description:
        api.providerManifests[x.domain]?.description ||
        $t("settings.playerprovider"),
    }))
    .sort((a, b) => a.name.localeCompare(b.name));
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

  return providers;
});

const addPlayerGroup = function (lookupKey: string) {
  router.push(`/settings/addgroup/${lookupKey}`);
  close();
};

const close = function () {
  emit("update:show", false);
};

watch(
  () => api.providers,
  () => {},
  { immediate: true },
);
</script>

<style scoped>
.add-player-group-dialog {
  height: 600px;
  display: flex;
  flex-direction: column;
}

.search-field {
  width: 100%;
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
  .add-player-group-dialog {
    height: 500px;
  }

  .provider-list-container {
    height: 300px;
  }
}
</style>
