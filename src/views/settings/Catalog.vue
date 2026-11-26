<template>
  <div class="flex flex-col gap-6 p-6 max-md:gap-5 max-md:px-3 max-md:py-4">
    <!-- only the community catalog has options here, so only an admin gets the menu -->
    <CatalogHeader
      v-model:search="searchQuery"
      :searchable="ready && activeTab !== CATALOG_INSTALLED_TAB"
      :menu-items="community.isAdmin ? getMenuItems : undefined"
      :menu-disabled="!community.settled"
    />

    <!-- a state of the page rather than an offer, so it shows on every section -->
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
      <CatalogToolbar
        v-model:stages="selectedStages"
        v-model:label="selectedLabel"
        :tab="activeTab"
        :types="tabCounts"
        :installed-count="installedCount"
        :update-count="community.updateCount"
        :labels="filterLabels"
        :filterable="listShown"
        @select="selectTab"
      />

      <CatalogTypeList
        v-if="listShown"
        :key="activeTab"
        :entries="listEntries"
        :query="searchQuery"
        :stages="selectedStages"
        :label="selectedLabel"
        :type="activeType"
        :installing="community.installing"
        :badges="badges"
        @open="openDetail"
        @add="addEntry"
      />
      <CatalogDiscover
        v-else-if="activeTab !== CATALOG_INSTALLED_TAB"
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
      <div v-else class="flex flex-col gap-8">
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
import CatalogToolbar from "@/components/settings/catalog/CatalogToolbar.vue";
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
import { Spinner } from "@/components/ui/spinner";
import { useCatalogDetail } from "@/composables/settings/catalog/useCatalogDetail";
import { useCommunityCatalog } from "@/composables/settings/catalog/useCommunityCatalog";
import { useCatalogRecommendations } from "@/composables/settings/catalog/useCatalogRecommendations";
import { useDismissedSuggestions } from "@/composables/settings/catalog/useDismissedSuggestions";
import { useProviderCatalog } from "@/composables/settings/catalog/useProviderCatalog";
import {
  getCatalogBadges,
  getCatalogSuggestions,
} from "@/helpers/catalog_recommendations";
import { getCommunityCatalogMenuItems } from "@/helpers/community_catalog_menu";
import { startAddProvider } from "@/helpers/provider_add";
import {
  CATALOG_INSTALLED_TAB,
  type CatalogEntry,
  catalogEntriesOfType,
  type CatalogTab,
  countCatalogTypes,
  FEATURE_REQUESTS_URL,
  filterCatalogEntries,
  getCatalogLabel,
  getCatalogTab,
  getCatalogTabQuery,
  getCatalogType,
  needsInstall,
} from "@/helpers/provider_catalog";
import {
  getFilterLabels,
  getProviderLabels,
  type ProviderLabel,
} from "@/helpers/provider_labels";
import { CircleAlert, RefreshCw } from "@lucide/vue";
import { computed, reactive, ref, watch } from "vue";
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

const { dismissed } = useDismissedSuggestions();

// why the lists of the types suggest an entry, from the suggestions of Discover
const badges = computed(() =>
  getCatalogBadges(
    getCatalogSuggestions(
      entries.value,
      recommendations.value,
      dismissed.value,
      // a list does not say what a suggestion goes well with
      () => undefined,
    ),
    community.enabled,
  ),
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
// the stage filter belongs to the list of one section, and starts empty on each
const selectedStages = ref<string[]>([]);
// the same goes for the label filter, which a link can pick for the type it opens
const selectedLabel = ref<ProviderLabel | null>(getCatalogLabel(route.query));

const { selectedEntry, detailOpen, openDetail, closeDetail } =
  useCatalogDetail(entries);

// a type is offered only when there is something of it to add
const typeCounts = computed(() => countCatalogTypes(entries.value));

const activeTab = computed(() =>
  getCatalogTab(
    route.query,
    typeCounts.value.map(({ type }) => type.type),
  ),
);

const activeType = computed(() => getCatalogType(activeTab.value));

// what each type lists with the search, and on its own section its filters
const tabCounts = computed(() =>
  typeCounts.value.map(({ type }) => {
    const active = type.type === activeTab.value;
    return {
      type,
      count: filterCatalogEntries(
        catalogEntriesOfType(entries.value, type.type),
        {
          query: searchQuery.value,
          stages: active ? selectedStages.value : [],
          label: active ? selectedLabel.value : null,
        },
      ).length,
    };
  }),
);

// a search on Discover looks through everything
const listShown = computed(
  () =>
    activeTab.value !== CATALOG_INSTALLED_TAB &&
    (!!activeType.value || !!searchQuery.value.trim()),
);

const listEntries = computed(() =>
  activeType.value
    ? catalogEntriesOfType(entries.value, activeType.value.type)
    : entries.value,
);

// the entries of a type can be filtered on what they offer, not a search
// through every type
const filterLabels = computed(() =>
  activeType.value
    ? getFilterLabels(
        listEntries.value.map((entry) => getProviderLabels(entry.manifest)),
      )
    : [],
);

const installedCount = computed(() =>
  installed.value.reduce((count, group) => count + group.items.length, 0),
);

const getMenuItems = () => getCommunityCatalogMenuItems(community);

watch(activeTab, () => {
  selectedStages.value = [];
  selectedLabel.value = getCatalogLabel(route.query);
});

const selectTab = (tab: CatalogTab) => {
  void router.replace({ query: getCatalogTabQuery(tab) });
};

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
