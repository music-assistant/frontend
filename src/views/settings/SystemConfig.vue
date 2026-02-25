<template>
  <Container variant="comfortable" class="settings-overview">
    <v-card class="settings-main-card">
      <v-list class="settings-list">
        <!-- Core modules -->
        <v-list-item
          v-for="item in sortedCoreConfigs"
          :key="item.domain"
          :ripple="true"
          class="settings-list-item"
          @click="handleItemClick(item)"
        >
          <template #prepend>
            <v-avatar color="blue" size="48">
              <provider-icon :domain="item.domain" :size="24" color="white" />
            </v-avatar>
          </template>

          <v-list-item-title class="text-h6">
            {{ getItemTitle(item) }}
          </v-list-item-title>

          <v-list-item-subtitle>
            {{ getItemDescription(item) }}
          </v-list-item-subtitle>

          <template #append>
            <v-icon
              v-if="item.last_error"
              color="red"
              icon="mdi-alert-circle"
              class="mr-2"
              :title="item.last_error"
            />
            <v-icon icon="mdi-chevron-right" />
          </template>
        </v-list-item>

        <!-- Extra system entries -->
        <v-list-item
          v-for="item in extraSystemEntries"
          :key="item.domain"
          :ripple="true"
          class="settings-list-item"
          @click="handleItemClick(item)"
        >
          <template #prepend>
            <v-avatar color="purple" size="48">
              <v-icon :icon="item.icon" size="24" color="white" />
            </v-avatar>
          </template>

          <v-list-item-title class="text-h6">
            {{ t(item.name) }}
          </v-list-item-title>

          <v-list-item-subtitle>
            {{ t(item.description) }}
          </v-list-item-subtitle>

          <template #append>
            <v-icon icon="mdi-chevron-right" />
          </template>
        </v-list-item>
      </v-list>
    </v-card>
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { api } from "@/plugins/api";
import { CoreConfig } from "@/plugins/api/interfaces";
import { onMounted, ref, computed } from "vue";
import { useRouter } from "vue-router";
import { useI18n } from "vue-i18n";

// global refs
const router = useRouter();
const { t } = useI18n();

// local refs
const coreConfigs = ref<CoreConfig[]>([]);

// Extra system entries that are not core modules
const extraSystemEntries = [
  {
    domain: "logging",
    name: "settings.system_logging",
    description: "settings.system_logging_description",
    icon: "mdi-text-box-search",
    route: "/settings/serverlogs",
  },
  {
    domain: "genre_management",
    name: "settings.genre_management",
    description: "settings.genre_management_description",
    icon: "mdi-compass-outline",
    route: "/settings/genremanagement",
  },
];

// Computed properties
const sortedCoreConfigs = computed(() => {
  return [...coreConfigs.value].sort((a, b) =>
    api.providerManifests[a.domain].name!.localeCompare(
      api.providerManifests[b.domain].name!,
    ),
  );
});

// methods
const getItemTitle = (item: CoreConfig) => {
  // Try translation first, fall back to manifest
  const translated = t(`settings.core_module.${item.domain}.name`);
  // If translation returns the key itself, it doesn't exist - use manifest
  return translated !== `settings.core_module.${item.domain}.name`
    ? translated
    : api.providerManifests[item.domain].name;
};

const getItemDescription = (item: CoreConfig) => {
  const translated = t(`settings.core_module.${item.domain}.description`);
  return translated !== `settings.core_module.${item.domain}.description`
    ? translated
    : api.providerManifests[item.domain].description;
};

const handleItemClick = function (item: any) {
  if (item.route) {
    // Extra entry with custom route
    router.push(item.route);
  } else {
    // Core config
    router.push(`/settings/editcore/${item.domain}`);
  }
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
});
</script>

<style scoped>
.settings-overview {
  padding: 24px;
  max-width: 800px;
  margin: 0 auto;
}

.settings-main-card {
  overflow: hidden;
}

.settings-list {
  padding: 0;
}

.settings-list-item {
  cursor: pointer;
  padding: 20px 24px;
  min-height: 80px;
  border-bottom: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
}

.settings-list-item:last-child {
  border-bottom: none;
}

.settings-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.settings-list-item :deep(.v-list-item__prepend) {
  margin-right: 16px;
}

.v-avatar {
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
}

/* Mobile optimizations */
@media (max-width: 600px) {
  .settings-list-item {
    padding: 12px 16px;
    min-height: 64px;
  }

  .settings-list-item :deep(.v-list-item__prepend) {
    margin-right: 12px;
  }

  .settings-list-item :deep(.v-avatar) {
    width: 40px !important;
    height: 40px !important;
  }

  .settings-list-item :deep(.v-list-item-title) {
    font-size: 1rem !important;
    line-height: 1.3;
  }

  .settings-list-item :deep(.v-list-item-subtitle) {
    font-size: 0.813rem !important;
    line-height: 1.3;
  }
}
</style>
