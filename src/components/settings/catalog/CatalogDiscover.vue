<template>
  <div class="flex flex-col gap-10" data-testid="catalog-discover">
    <CatalogTopPick
      v-if="picks.length"
      :picks="picks"
      :installing="installing"
      @open="emit('open', $event)"
      @add="emit('add', $event)"
      @dismiss="letGo"
    />

    <CatalogSuggestionRow
      v-for="row in rows"
      :key="row.key"
      :suggestions="row.suggestions"
      :title="$t(row.title, { version: releaseLine })"
      :installing="installing"
      :data-testid="`catalog-${row.key}`"
      @open="emit('open', $event)"
      @add="emit('add', $event)"
      @dismiss="letGo"
    />

    <CatalogCommunityBanner
      v-if="offerCommunity"
      @enable="emit('enable-community')"
    />

    <CatalogBrowseTypes :types="types" @select="emit('select-type', $event)" />
  </div>
</template>

<script setup lang="ts">
import CatalogBrowseTypes from "@/components/settings/catalog/CatalogBrowseTypes.vue";
import CatalogCommunityBanner from "@/components/settings/catalog/CatalogCommunityBanner.vue";
import CatalogSuggestionRow from "@/components/settings/catalog/CatalogSuggestionRow.vue";
import CatalogTopPick from "@/components/settings/catalog/CatalogTopPick.vue";
import { useDismissedSuggestions } from "@/composables/settings/catalog/useDismissedSuggestions";
import {
  getCatalogSuggestions,
  getReleaseLine,
  getSuggestionRows,
  getTopPicks,
} from "@/helpers/catalog_recommendations";
import type {
  CatalogEntry,
  CatalogTypeCount,
} from "@/helpers/provider_catalog";
import { api } from "@/plugins/api";
import type {
  CatalogRecommendation,
  ProviderType,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

interface Props {
  entries: CatalogEntry[];
  // what the server suggests, as it sent it
  recommendations: CatalogRecommendation[];
  // whether the community catalog is enabled for the user, to show what is new in it
  withCommunity: boolean;
  // whether to offer to enable the community catalog
  offerCommunity: boolean;
  types: CatalogTypeCount[];
  // the domains being installed from the community catalog
  installing: ReadonlySet<string>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
  (e: "enable-community"): void;
  (e: "select-type", type: ProviderType): void;
}>();

const { dismissed, dismiss } = useDismissedSuggestions();

const letGo = (domain: string) => {
  const entry = props.entries.find((item) => item.manifest.domain === domain);
  void dismiss(domain, entry?.manifest.name ?? domain);
};

const suggestions = computed(() =>
  getCatalogSuggestions(
    props.entries,
    props.recommendations,
    dismissed.value,
    (domain) => api.providerManifests[domain]?.name,
  ),
);

const picks = computed(() => getTopPicks(suggestions.value, Date.now()));

const rows = computed(() =>
  getSuggestionRows(suggestions.value, props.withCommunity, picks.value[0]),
);

// the release line of the server, which names what is new in it
const releaseLine = computed(() =>
  getReleaseLine(api.serverInfo.value?.server_version ?? ""),
);
</script>
