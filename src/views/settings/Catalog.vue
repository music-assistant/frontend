<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <!-- only the community catalog has options here, so only an admin gets the menu -->
    <CatalogHeader
      :installed-count="loaded ? installedCount : null"
      :update-count="community.updateCount"
      :installed-open="activeTab === CATALOG_INSTALLED_TAB"
      :menu-items="community.isAdmin ? getMenuItems : undefined"
      :menu-disabled="!community.settled"
      @toggle-installed="toggleInstalled"
    />

    <!-- a state of the page rather than an offer, so it shows on every tab -->
    <CatalogCommunityUnavailable
      v-if="community.status === 'unavailable'"
      :reason="community.unavailableReason"
    />

    <CommunityMovedNotice
      :providers="community.moved"
      @dismiss="community.dismissNotice"
    />

    <!-- what is set up decides what may be added, so nothing shows before it is known -->
    <Empty
      v-if="!loaded && failed"
      class="rounded-(--radius-xl) border"
      data-testid="catalog-load-failed"
    >
      <EmptyHeader>
        <EmptyMedia variant="icon">
          <CircleAlert />
        </EmptyMedia>
        <EmptyTitle>{{ $t("settings.catalog.load_failed") }}</EmptyTitle>
      </EmptyHeader>
      <EmptyContent>
        <Button variant="outline" data-testid="catalog-retry" @click="reload">
          <RefreshCw class="size-4" aria-hidden="true" />
          {{ $t("settings.catalog.try_again") }}
        </Button>
      </EmptyContent>
    </Empty>
    <div
      v-else-if="!ready"
      class="flex min-h-24 items-center justify-center"
      data-testid="catalog-loading"
    >
      <Spinner class="size-8" />
    </div>

    <template v-else>
      <SearchInput
        v-if="activeTab !== CATALOG_INSTALLED_TAB"
        v-model="searchQuery"
        :placeholder="$t('settings.catalog.search')"
        clearable
        class="w-full"
      />

      <!-- the Installed view has no tab of its own: the tabs lead back from it -->
      <Tabs
        :model-value="activeTab"
        class="gap-6"
        @update:model-value="selectTab"
      >
        <!-- the tabs scroll sideways on a phone rather than wrapping -->
        <div
          ref="tabStrip"
          class="relative -mx-6 overflow-x-auto px-6 [scrollbar-width:none] max-md:-mx-3 max-md:px-3"
        >
          <TabsList variant="line" data-testid="catalog-tabs">
            <TabsTrigger :value="CATALOG_DISCOVER_TAB">
              {{ $t("settings.catalog.discover") }}
            </TabsTrigger>
            <TabsTrigger
              v-for="{ type, count } in tabCounts"
              :key="type.type"
              :value="type.type"
            >
              {{ $t(type.label) }}
              <span class="text-sm text-muted-foreground">{{ count }}</span>
            </TabsTrigger>
          </TabsList>
        </div>

        <TabsContent
          v-if="activeTab !== CATALOG_INSTALLED_TAB"
          :value="activeTab"
        >
          <!-- a search on Discover looks through everything -->
          <CatalogDiscover
            v-if="!activeType && !searchQuery.trim()"
            :entries="entries"
            :recommendations="recommendations"
            :with-community="community.enabled"
            :offer-community="community.available && !community.enabled"
            :types="typeCounts"
            :installing="community.installing"
            @open="openDetail"
            @add="addEntry"
            @enable-community="community.setEnabled(true)"
            @select-type="selectTab"
          />
          <CatalogTypeList
            v-else
            :key="activeTab"
            v-model:stages="selectedStages"
            :entries="listEntries"
            :query="searchQuery"
            :title="
              activeType
                ? $t(activeType.label)
                : $t('settings.catalog.search_results')
            "
            :type="activeType"
            :installing="community.installing"
            @open="openDetail"
            @add="addEntry"
          />
        </TabsContent>
      </Tabs>

      <div
        v-if="activeTab === CATALOG_INSTALLED_TAB"
        class="flex flex-col gap-8"
      >
        <CatalogCommunityInstalled
          v-if="showCommunityInstalled"
          :providers="community.installed"
          :removing="community.removing"
          :is-updating="community.isUpdating"
          :updating-all="community.updatingAll"
          @remove="community.remove"
          @update="community.update"
          @update-all="community.updateAll"
        />
        <CatalogInstalled :groups="installed" />
      </div>
    </template>

    <i18n-t
      keypath="settings.catalog.missing"
      tag="p"
      scope="global"
      class="m-0 pt-4 pb-2 text-center text-sm text-muted-foreground"
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
      :installing="community.installing.has(selectedEntry.manifest.domain)"
      :updating="community.isUpdating(selectedEntry.manifest.domain)"
      @add="addEntry(selectedEntry, closeDetail)"
      @update="community.update(selectedEntry.community!)"
    />

    <CommunityInstallNote
      v-if="pendingAdd"
      v-model:open="noteOpen"
      :entry="pendingAdd.entry"
      @continue="continueAdd"
    />
  </div>
</template>

<script setup lang="ts">
import CatalogCommunityInstalled from "@/components/settings/catalog/CatalogCommunityInstalled.vue";
import CatalogCommunityUnavailable from "@/components/settings/catalog/CatalogCommunityUnavailable.vue";
import CatalogDiscover from "@/components/settings/catalog/CatalogDiscover.vue";
import CatalogEntryDialog from "@/components/settings/catalog/CatalogEntryDialog.vue";
import CatalogHeader from "@/components/settings/catalog/CatalogHeader.vue";
import CatalogInstalled from "@/components/settings/catalog/CatalogInstalled.vue";
import CatalogTypeList from "@/components/settings/catalog/CatalogTypeList.vue";
import CommunityInstallNote from "@/components/settings/catalog/CommunityInstallNote.vue";
import CommunityMovedNotice from "@/components/settings/catalog/CommunityMovedNotice.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { SearchInput } from "@/components/ui/search-input";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCatalogDetail } from "@/composables/settings/catalog/useCatalogDetail";
import { useCommunityCatalog } from "@/composables/settings/catalog/useCommunityCatalog";
import { useCatalogRecommendations } from "@/composables/settings/catalog/useCatalogRecommendations";
import { useProviderCatalog } from "@/composables/settings/catalog/useProviderCatalog";
import { getCommunityCatalogMenuItems } from "@/helpers/community_catalog_menu";
import { startAddProvider } from "@/helpers/provider_add";
import {
  CATALOG_DISCOVER_TAB,
  CATALOG_INSTALLED_TAB,
  type CatalogEntry,
  type CatalogTab,
  countCatalogTypes,
  FEATURE_REQUESTS_URL,
  filterCatalogEntries,
  getCatalogTab,
  getCatalogTabQuery,
  getCatalogType,
  needsInstall,
} from "@/helpers/provider_catalog";
import { CircleAlert, RefreshCw } from "@lucide/vue";
import { computed, nextTick, reactive, ref, useTemplateRef, watch } from "vue";
import { useRoute, useRouter } from "vue-router";

const route = useRoute();
const router = useRouter();

const community = reactive(useCommunityCatalog());

const { entries, installed, loaded, failed, reload } = useProviderCatalog(
  () => community.listed,
);

const { recommendations, settled: recommendationsSettled } =
  useCatalogRecommendations(() =>
    community.settled ? community.enabled : undefined,
  );

// the community catalog joins the list and the suggestions lead Discover, so
// the page waits for both too
const ready = computed(
  () => loaded.value && community.settled && recommendationsSettled.value,
);

// the Installed view looks after it while it is shown or anything is installed
const showCommunityInstalled = computed(
  () =>
    community.available &&
    (community.enabled || community.installed.length > 0),
);

// an entry from the community catalog waiting for its note to be confirmed
const pendingAdd = ref<{ entry: CatalogEntry; onStart?: () => void } | null>(
  null,
);
const noteOpen = ref(false);

const searchQuery = ref("");
// the stage filter belongs to the list of one tab, and starts empty on each
const selectedStages = ref<string[]>([]);

const { selectedEntry, detailOpen, openDetail, closeDetail } =
  useCatalogDetail(entries);

// a type gets a tab only when there is something of it to add
const typeCounts = computed(() => countCatalogTypes(entries.value));

const activeTab = computed(() =>
  getCatalogTab(
    route.query,
    typeCounts.value.map(({ type }) => type.type),
  ),
);

const activeType = computed(() => getCatalogType(activeTab.value));

// what each tab lists with the search, and on the active tab its stage filter
const tabCounts = computed(() =>
  typeCounts.value.map(({ type }) => ({
    type,
    count: filterCatalogEntries(entries.value, {
      types: [type.type],
      query: searchQuery.value,
      stages: type.type === activeTab.value ? selectedStages.value : [],
    }).length,
  })),
);

const listEntries = computed(() =>
  activeType.value
    ? entries.value.filter(
        (entry) => entry.manifest.type === activeType.value!.type,
      )
    : entries.value,
);

const installedCount = computed(() =>
  installed.value.reduce((count, group) => count + group.items.length, 0),
);

const getMenuItems = () => getCommunityCatalogMenuItems(community);

watch(activeTab, () => {
  selectedStages.value = [];
});

const selectTab = (tab: string | number) => {
  void router.replace({ query: getCatalogTabQuery(tab as CatalogTab) });
};

const toggleInstalled = () => {
  selectTab(
    activeTab.value === CATALOG_INSTALLED_TAB
      ? CATALOG_DISCOVER_TAB
      : CATALOG_INSTALLED_TAB,
  );
};

// on a phone the tabs are wider than the screen: keep the active one in view
const tabStrip = useTemplateRef<HTMLElement>("tabStrip");
watch([activeTab, tabStrip], async () => {
  await nextTick();
  const strip = tabStrip.value;
  const active = strip?.querySelector<HTMLElement>("[data-state='active']");
  if (!strip || !active) return;
  const left =
    active.offsetLeft - strip.clientWidth / 2 + active.offsetWidth / 2;
  strip.scrollTo?.({ left, behavior: "smooth" });
});

// one from the community catalog is added only after its note is confirmed,
// shown each time
const addEntry = (entry: CatalogEntry, onStart?: () => void) => {
  if (!entry.community) {
    startAddProvider(entry.manifest, onStart);
    return;
  }
  pendingAdd.value = { entry, onStart };
  noteOpen.value = true;
};

const continueAdd = async () => {
  noteOpen.value = false;
  if (!pendingAdd.value) return;
  const { entry: pending, onStart } = pendingAdd.value;
  // looked up again: another admin may have installed it while the note was open
  const entry = entries.value.find(
    (item) => item.manifest.domain === pending.manifest.domain,
  );
  if (!entry) return;
  const manifest = needsInstall(entry)
    ? await community.install(entry.community)
    : entry.manifest;
  if (manifest) startAddProvider(manifest, onStart);
};
</script>
