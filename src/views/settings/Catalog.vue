<template>
  <div class="flex flex-col gap-6 p-6 pb-20 max-md:px-3 max-md:py-4">
    <header class="flex items-center gap-4">
      <span
        class="flex size-12 shrink-0 items-center justify-center rounded-(--radius-lg) bg-primary/10 text-primary"
      >
        <Blocks class="size-6" aria-hidden="true" />
      </span>
      <div class="min-w-0">
        <h1 class="m-0 text-2xl leading-tight font-semibold">
          {{ $t("settings.catalog.title") }}
        </h1>
        <p class="m-0 mt-1 text-sm text-muted-foreground">
          {{ $t("settings.catalog.description") }}
        </p>
      </div>
    </header>

    <Tabs :model-value="activeTab" @update:model-value="selectTab">
      <!-- the tabs scroll sideways on a phone rather than wrapping -->
      <div class="-mx-6 overflow-x-auto px-6 max-md:-mx-3 max-md:px-3">
        <TabsList variant="line" data-testid="catalog-tabs">
          <TabsTrigger :value="CATALOG_ALL_TAB">
            {{ $t("settings.catalog.all") }}
          </TabsTrigger>
          <TabsTrigger
            v-for="type in tabTypes"
            :key="type.type"
            :value="type.type"
          >
            {{ $t(type.label) }}
          </TabsTrigger>
          <TabsTrigger :value="CATALOG_INSTALLED_TAB">
            {{ $t("settings.catalog.installed") }}
            <span class="text-muted-foreground">{{ installedCount }}</span>
          </TabsTrigger>
        </TabsList>
      </div>
    </Tabs>

    <CatalogInstalled
      v-if="activeTab === CATALOG_INSTALLED_TAB"
      :groups="installed"
    />

    <template v-else>
      <div class="flex flex-wrap items-center gap-2">
        <SearchInput
          v-model="searchQuery"
          :placeholder="$t('search')"
          clearable
          class="max-w-md min-w-48 flex-1"
        />
        <FacetedFilter
          v-model="selectedStages"
          :title="$t('settings.stage.label')"
          :options="stageOptions"
        />
        <RouterLink
          v-if="activeType"
          :to="getTypeSettingsRoute(activeType.type)"
          class="ml-auto flex items-center gap-1 text-sm text-primary no-underline hover:underline"
          data-testid="catalog-manage-link"
        >
          {{ $t(activeType.manageLabel) }}
          <ChevronRight class="size-4" aria-hidden="true" />
        </RouterLink>
      </div>

      <CatalogBrowse
        :entries="filteredEntries"
        :popular="popularEntries"
        :title="listTitle"
        @open="openDetail"
        @add="addEntry"
      />
    </template>

    <i18n-t
      keypath="settings.catalog.missing"
      tag="p"
      scope="global"
      class="m-0 text-center text-sm text-muted-foreground"
      data-testid="catalog-request"
    >
      <template #link>
        <a
          :href="FEATURE_REQUESTS_URL"
          target="_blank"
          rel="noopener noreferrer"
          class="text-primary no-underline hover:underline"
          >{{ $t("settings.catalog.request_it") }}</a
        >
      </template>
    </i18n-t>

    <CatalogEntryDialog
      v-if="selectedEntry"
      v-model:open="detailOpen"
      :entry="selectedEntry"
      @add="addEntry(selectedEntry, closeDetail)"
    />
  </div>
</template>

<script setup lang="ts">
import FacetedFilter from "@/components/FacetedFilter.vue";
import CatalogBrowse from "@/components/settings/catalog/CatalogBrowse.vue";
import CatalogEntryDialog from "@/components/settings/catalog/CatalogEntryDialog.vue";
import CatalogInstalled from "@/components/settings/catalog/CatalogInstalled.vue";
import { SearchInput } from "@/components/ui/search-input";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useProviderCatalog } from "@/composables/settings/catalog/useProviderCatalog";
import { startAddProvider } from "@/helpers/provider_add";
import {
  ADDABLE_PROVIDER_STAGES,
  CATALOG_ALL_TAB,
  CATALOG_INSTALLED_TAB,
  CATALOG_TYPES,
  type CatalogEntry,
  type CatalogTab,
  FEATURE_REQUESTS_URL,
  filterCatalogEntries,
  getCatalogTab,
  getCatalogTabQuery,
  getCatalogType,
  getPopularEntries,
  getTypeSettingsRoute,
} from "@/helpers/provider_catalog";
import { getProviderStageTranslationKey } from "@/helpers/provider_config";
import { $t } from "@/plugins/i18n";
import { Blocks, ChevronRight } from "@lucide/vue";
import { computed, ref } from "vue";
import { RouterLink, useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const { entries, installed } = useProviderCatalog();

const searchQuery = ref("");
const selectedStages = ref<string[]>([]);
const selectedDomain = ref<string | null>(null);
const detailOpen = ref(false);

// a type gets a tab only when there is something of it to add
const tabTypes = computed(() =>
  CATALOG_TYPES.filter((type) =>
    entries.value.some((entry) => entry.manifest.type === type.type),
  ),
);

const activeTab = computed(() =>
  getCatalogTab(
    route.query,
    tabTypes.value.map((type) => type.type),
  ),
);

const activeType = computed(() => getCatalogType(activeTab.value));

const installedCount = computed(() =>
  installed.value.reduce((count, group) => count + group.items.length, 0),
);

const stageOptions = computed(() =>
  ADDABLE_PROVIDER_STAGES.map((stage) => ({
    label: $t(getProviderStageTranslationKey(stage)!),
    value: stage,
  })),
);

const typeEntries = computed(() =>
  filterCatalogEntries(entries.value, {
    types: activeType.value ? [activeType.value.type] : [],
  }),
);

const filteredEntries = computed(() =>
  filterCatalogEntries(typeEntries.value, {
    query: searchQuery.value,
    stages: selectedStages.value,
  }),
);

// the row leads the tab only until a search or a filter narrows it down
const popularEntries = computed(() =>
  searchQuery.value.trim() || selectedStages.value.length
    ? []
    : getPopularEntries(typeEntries.value),
);

const listTitle = computed(() =>
  activeType.value
    ? $t(activeType.value.label)
    : $t("settings.catalog.everything"),
);

// looked up again on every change, so an added instance shows in the open detail
const selectedEntry = computed(() =>
  entries.value.find((entry) => entry.manifest.domain === selectedDomain.value),
);

const selectTab = (tab: string | number) => {
  void router.replace({ query: getCatalogTabQuery(tab as CatalogTab) });
};

const openDetail = (entry: CatalogEntry) => {
  selectedDomain.value = entry.manifest.domain;
  detailOpen.value = true;
};

const closeDetail = () => {
  detailOpen.value = false;
};

const addEntry = (entry: CatalogEntry, onStart?: () => void) => {
  startAddProvider(entry.manifest, onStart);
};
</script>
