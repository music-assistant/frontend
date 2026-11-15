<template>
  <div class="space-y-8">
    <CatalogPopularRow
      v-if="popular.length"
      :entries="popular"
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
          @open="emit('open', entry)"
          @add="emit('add', entry)"
        />
      </div>
      <Empty v-else class="border-0 py-16" data-testid="catalog-empty">
        <EmptyHeader>
          <EmptyMedia>
            <SearchX
              class="size-16 text-muted-foreground opacity-40"
              aria-hidden="true"
            />
          </EmptyMedia>
          <EmptyTitle class="text-muted-foreground">
            {{ $t("settings.catalog.no_match") }}
          </EmptyTitle>
        </EmptyHeader>
      </Empty>
    </section>
  </div>
</template>

<script setup lang="ts">
import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import CatalogPopularRow from "@/components/settings/catalog/CatalogPopularRow.vue";
import CatalogSectionHeading from "@/components/settings/catalog/CatalogSectionHeading.vue";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { CatalogEntry } from "@/helpers/provider_catalog";
import { SearchX } from "@lucide/vue";

interface Props {
  // the entries matching the tab, search and filters
  entries: CatalogEntry[];
  // shown above the list; empty hides the row
  popular: CatalogEntry[];
  title: string;
}

defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
}>();
</script>
