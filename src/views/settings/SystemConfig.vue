<template>
  <v-container class="pa-4 mx-auto" style="max-width: 600px">
    <v-list lines="two" class="bg-transparent pa-0">
      <!-- Core modules -->
      <v-list-item
        v-for="item in sortedCoreConfigs"
        :key="item.domain"
        :ripple="true"
        class="settings-item py-3 mb-3 rounded-lg border"
        elevation="0"
        @click="handleItemClick(item)"
      >
        <template #prepend>
          <v-avatar color="blue" variant="tonal" size="40" class="mr-4">
            <provider-icon :domain="item.domain" :size="24" />
          </v-avatar>
        </template>

        <v-list-item-title>
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
          <v-icon icon="mdi-chevron-right" color="grey" />
        </template>
      </v-list-item>

      <!-- Extra system entries -->
      <v-list-item
        v-for="item in extraSystemEntries"
        :key="item.domain"
        :ripple="true"
        class="settings-item py-3 mb-3 rounded-lg border"
        elevation="0"
        @click="handleItemClick(item)"
      >
        <template #prepend>
          <v-avatar color="purple" variant="tonal" size="40" class="mr-4">
            <v-icon :icon="item.icon" size="24" />
          </v-avatar>
        </template>

        <v-list-item-title>
          {{ t(item.name) }}
        </v-list-item-title>

        <v-list-item-subtitle>
          {{ t(item.description) }}
        </v-list-item-subtitle>

        <template #append>
          <v-icon icon="mdi-chevron-right" color="grey" />
        </template>
      </v-list-item>
    </v-list>
  </v-container>
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
.settings-item {
  transition: background-color 0.2s ease-in-out;
  background-color: rgb(var(--v-theme-surface));
  cursor: pointer;
}

.settings-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.04);
}
</style>
