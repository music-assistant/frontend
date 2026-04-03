<template>
  <Container variant="comfortable" class="settings-overview">
    <div v-if="viewMode === 'card'" class="settings-grid">
      <Card
        v-for="item in sortedCoreConfigs"
        :key="item.domain"
        class="setting-card"
        @click="handleItemClick(item)"
      >
        <CardHeader>
          <div class="setting-header-top">
            <div class="setting-icon" :style="getIconBackgroundStyle('blue')">
              <div class="provider-icon-white">
                <provider-icon :domain="item.domain" :size="20" />
              </div>
            </div>
            <div class="setting-chevron">
              <v-icon
                v-if="item.last_error"
                color="red"
                icon="mdi-alert-circle"
                :title="item.last_error"
              />
              <v-icon icon="mdi-chevron-right" size="20" />
            </div>
          </div>
          <CardTitle class="setting-title">{{ getItemTitle(item) }}</CardTitle>
          <CardDescription class="setting-description">{{
            getItemDescription(item)
          }}</CardDescription>
        </CardHeader>
      </Card>

      <Card
        v-for="item in extraSystemEntries"
        :key="item.domain"
        class="setting-card"
        @click="handleItemClick(item)"
      >
        <CardHeader>
          <div class="setting-header-top">
            <div class="setting-icon" :style="getIconBackgroundStyle('purple')">
              <component
                :is="item.icon"
                v-if="typeof item.icon !== 'string'"
                class="size-5 text-white"
              />
              <v-icon v-else :icon="item.icon" size="20" color="white" />
            </div>
            <div class="setting-chevron">
              <v-icon icon="mdi-chevron-right" size="20" />
            </div>
          </div>
          <CardTitle class="setting-title">{{ t(item.name) }}</CardTitle>
          <CardDescription class="setting-description">{{
            t(item.description)
          }}</CardDescription>
        </CardHeader>
      </Card>
    </div>

    <v-list v-else class="settings-list">
      <ListItem
        v-for="item in sortedCoreConfigs"
        :key="item.domain"
        link
        class="settings-list-item"
        @click="handleItemClick(item)"
      >
        <template #prepend>
          <div
            class="setting-list-icon"
            :style="getIconBackgroundStyle('blue')"
          >
            <div class="provider-icon-white">
              <provider-icon :domain="item.domain" :size="20" />
            </div>
          </div>
        </template>
        <template #title>{{ getItemTitle(item) }}</template>
        <template #subtitle>{{ getItemDescription(item) }}</template>
        <template #append>
          <v-icon
            v-if="item.last_error"
            color="red"
            icon="mdi-alert-circle"
            class="mr-2"
            :title="item.last_error"
          />
          <v-icon icon="mdi-chevron-right" size="20" />
        </template>
      </ListItem>

      <ListItem
        v-for="item in extraSystemEntries"
        :key="item.domain"
        link
        class="settings-list-item"
        @click="handleItemClick(item)"
      >
        <template #prepend>
          <div
            class="setting-list-icon"
            :style="getIconBackgroundStyle('purple')"
          >
            <component
              :is="item.icon"
              v-if="typeof item.icon !== 'string'"
              class="size-5 text-white"
            />
            <v-icon v-else :icon="item.icon" size="20" color="white" />
          </div>
        </template>
        <template #title>{{ t(item.name) }}</template>
        <template #subtitle>{{ t(item.description) }}</template>
        <template #append>
          <v-icon icon="mdi-chevron-right" size="20" />
        </template>
      </ListItem>
    </v-list>
  </Container>
</template>

<script setup lang="ts">
import Container from "@/components/Container.vue";
import GenreIcon from "@/components/icons/GenreIcon.vue";
import ListItem from "@/components/ListItem.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  Card,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { api } from "@/plugins/api";
import { CoreConfig } from "@/plugins/api/interfaces";
import {
  computed,
  inject,
  onMounted,
  ref,
  type Component,
  type Ref,
} from "vue";
import { useI18n } from "vue-i18n";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();
const { t } = useI18n();

const injected = inject<{ viewMode: Ref<"list" | "card"> }>("systemViewMode");
const viewMode = computed(() => injected?.viewMode.value ?? "list");

// local refs
const coreConfigs = ref<CoreConfig[]>([]);

interface SystemConfigExtraEntry {
  domain: string;
  route: string;
  name: string;
  description: string;
  icon: string | Component;
}

type SystemConfigItem = CoreConfig | SystemConfigExtraEntry;

const extraSystemEntries: SystemConfigExtraEntry[] = [
  {
    domain: "logging",
    name: "settings.system_logging",
    description: "settings.system_logging_description",
    icon: "mdi-text-box-search",
    route: "/settings/serverlogs",
  },
  {
    domain: "tasks",
    name: "background_tasks.title",
    description: "background_tasks.description",
    icon: "mdi-playlist-play",
    route: "/settings/tasks",
  },
  {
    domain: "genre_management",
    name: "settings.genre_management",
    description: "settings.genre_management_description",
    icon: GenreIcon,
    route: "/settings/genremanagement",
  },
];

const sortedCoreConfigs = computed(() => {
  return [...coreConfigs.value].sort((a, b) =>
    api.providerManifests[a.domain].name!.localeCompare(
      api.providerManifests[b.domain].name!,
    ),
  );
});

const getItemTitle = (item: CoreConfig) => {
  const translated = t(`settings.core_module.${item.domain}.name`);
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

const handleItemClick = (item: SystemConfigItem) => {
  if ("route" in item && item.route) {
    router.push(item.route);
  } else {
    router.push(`/settings/editcore/${(item as CoreConfig).domain}`);
  }
};

const getIconBackgroundStyle = (color: "blue" | "purple") => {
  const colorMap = {
    blue: "rgb(59, 130, 246)",
    purple: "rgb(168, 85, 247)",
  };
  return { backgroundColor: colorMap[color] };
};

onMounted(async () => {
  coreConfigs.value = await api.getCoreConfigs();
});
</script>

<style scoped>
.settings-overview {
  padding: 24px;
  max-width: 1200px;
  margin: 0 auto;
}

.settings-list {
  padding: 0;
  background: transparent;
}

.list-item-main {
  border-radius: 10px !important;
}

.settings-list-item {
  cursor: pointer;
  padding: 20px 24px;
  min-height: 80px;
  border-bottom: none;
  background: transparent;
}

.settings-list-item:hover {
  background-color: rgba(var(--v-theme-on-surface), 0.05);
}

.settings-list-item :deep(.v-list-item__prepend) {
  padding-inline-end: 6px;
}

.settings-list-item :deep(.v-list-item__prepend .v-icon) {
  margin-inline-end: 0 !important;
}

.settings-list-item :deep(.v-list-item__content > div) {
  padding-left: 0;
}

.settings-list-item :deep(.v-list-item-title) {
  font-size: 1rem;
  font-weight: 600;
  line-height: 1.3;
}

.settings-list-item :deep(.v-list-item-subtitle) {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin-top: 4px;
}

.settings-list-item :deep(.v-list-item__append) {
  opacity: 0.4;
  transition: opacity 0.2s ease;
}

.settings-list-item:hover :deep(.v-list-item__append) {
  opacity: 1;
}

.setting-list-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.settings-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
}

@media (min-width: 960px) {
  .settings-grid {
    grid-template-columns: repeat(2, 1fr);
  }
}

@media (min-width: 1280px) {
  .settings-grid {
    grid-template-columns: repeat(3, 1fr);
  }
}

.setting-card {
  cursor: pointer;
  position: relative;
  transition:
    transform 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    box-shadow 0.2s cubic-bezier(0.4, 0, 0.2, 1),
    border-color 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  overflow: hidden;
  border: 1px solid rgba(var(--v-border-color), var(--v-border-opacity));
  padding: 6px 0 0 0;
}

.setting-card:hover {
  transform: translateY(-4px);
  box-shadow:
    0 12px 24px rgba(0, 0, 0, 0.15),
    0 4px 8px rgba(0, 0, 0, 0.1);
  border-color: rgba(var(--v-theme-primary), 0.3);
}

.setting-header-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}

.setting-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s ease;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
  flex-shrink: 0;
}

.setting-card:hover .setting-icon {
  transform: scale(1.1) rotate(5deg);
}

.setting-chevron {
  opacity: 0.4;
  transition:
    opacity 0.2s ease,
    transform 0.2s ease,
    background 0.2s ease,
    color 0.2s ease;
  display: flex;
  align-items: center;
  justify-content: center;
  width: 32px;
  height: 32px;
  border-radius: 50%;
  background: rgba(var(--v-theme-on-surface), 0.05);
  flex-shrink: 0;
}

.setting-card:hover .setting-chevron {
  opacity: 1;
  transform: translateX(4px);
  background: rgba(var(--v-theme-primary), 0.1);
  color: rgb(var(--v-theme-primary));
}

.setting-title {
  font-size: 1rem;
  font-weight: 600;
  margin-bottom: 4px;
  line-height: 1.3;
}

.setting-description {
  font-size: 0.875rem;
  line-height: 1.5;
  color: rgba(var(--v-theme-on-surface), 0.7);
  margin: 0;
}

.provider-icon-white {
  filter: brightness(0) invert(1);
  display: flex;
  align-items: center;
  justify-content: center;
}

@media (max-width: 768px) {
  .settings-overview {
    padding: 16px 12px;
  }

  .settings-grid {
    grid-template-columns: 1fr;
    gap: 12px;
  }

  .setting-header-top {
    margin-bottom: 8px;
  }

  .setting-icon {
    width: 40px;
    height: 40px;
  }

  .setting-chevron {
    width: 26px;
    height: 26px;
  }
}
</style>
