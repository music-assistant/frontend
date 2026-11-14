<template>
  <div class="space-y-8">
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

    <section class="space-y-3" data-testid="catalog-list">
      <CatalogSectionHeading :title="title" />
      <div
        v-if="entries.length"
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-3"
      >
        <CatalogCard
          v-for="entry in entries"
          :key="entry.manifest.domain"
          :entry="entry"
          :installing="installing.has(entry.manifest.domain)"
          @open="emit('open', entry)"
          @add="emit('add', entry)"
        />
      </div>
      <FilterEmptyState v-else :icon="SearchX" data-testid="catalog-empty" />
    </section>
  </div>
</template>

<script setup lang="ts">
import FilterEmptyState from "@/components/FilterEmptyState.vue";
import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import CatalogPopularRow from "@/components/settings/catalog/CatalogPopularRow.vue";
import CatalogSectionHeading from "@/components/settings/catalog/CatalogSectionHeading.vue";
import type { CatalogEntry, CatalogRow } from "@/helpers/provider_catalog";
import { $t } from "@/plugins/i18n";
import { SearchX } from "@lucide/vue";

interface Props {
  // the entries matching the tab, search and filters
  entries: CatalogEntry[];
  // shown above the list, each a row to scroll through
  rows: CatalogRow[];
  title: string;
  // the domains being installed from the community catalog
  installing: ReadonlySet<string>;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
}>();
</script>
