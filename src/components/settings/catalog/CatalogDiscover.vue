<template>
  <div class="flex flex-col gap-10" data-testid="catalog-discover">
    <CatalogTopPick
      v-if="picks.length"
      :picks="picks"
      :installing="installing"
      @open="emit('open', $event)"
      @add="emit('add', $event)"
    />

    <CatalogPopularRow
      v-for="row in rows"
      :key="row.key"
      :entries="row.entries"
      :title="$t(row.title)"
      :installing="installing"
      :data-testid="`catalog-${row.key}`"
      @open="emit('open', $event)"
      @add="emit('add', $event)"
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
import CatalogPopularRow from "@/components/settings/catalog/CatalogPopularRow.vue";
import CatalogTopPick from "@/components/settings/catalog/CatalogTopPick.vue";
import {
  type CatalogEntry,
  type CatalogTypeCount,
  getCatalogRows,
  getTopPicks,
} from "@/helpers/provider_catalog";
import type { ProviderType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

interface Props {
  entries: CatalogEntry[];
  // whether the community catalog is enabled, to show what is new in it
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

const picks = computed(() =>
  getTopPicks(props.entries, props.withCommunity, Date.now()),
);

const rows = computed(() =>
  getCatalogRows(
    props.entries,
    props.withCommunity,
    Date.now(),
    picks.value[0],
  ),
);
</script>
