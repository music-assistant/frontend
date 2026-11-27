<template>
  <section class="space-y-4" data-testid="catalog-list">
    <!-- the picker names the section on screen; this names it for the outline -->
    <h2 class="sr-only">{{ heading }}</h2>
    <div class="flex flex-wrap items-baseline justify-between gap-x-3 gap-y-1">
      <p
        class="m-0 text-[13px] text-muted-foreground"
        data-testid="catalog-list-summary"
      >
        {{ summary }}
      </p>
      <RouterLink
        v-if="type"
        :to="getTypeSettingsRoute(type.type)"
        class="flex items-center gap-1 text-sm text-primary no-underline hover:underline"
        data-testid="catalog-manage-link"
      >
        {{ $t(type.manageLabel) }}
        <ChevronRight class="size-4" aria-hidden="true" />
      </RouterLink>
    </div>

    <template v-if="matches.length">
      <CatalogGrid>
        <CatalogCard
          v-for="entry in shown"
          :key="entry.manifest.domain"
          :entry="entry"
          :installing="installing.has(entry.manifest.domain)"
          :badge="getBadgeLabel(entry)"
          :show-type="!type"
          @open="emit('open', entry)"
          @add="emit('add', entry)"
        />
      </CatalogGrid>
      <div
        v-if="shown.length < matches.length"
        class="flex flex-col items-center gap-2 pt-2"
      >
        <span
          class="text-sm text-muted-foreground"
          data-testid="catalog-list-count"
        >
          {{
            $t("settings.catalog.shown_of", {
              shown: shown.length,
              total: matches.length,
            })
          }}
        </span>
        <Button
          variant="outline"
          data-testid="catalog-show-more"
          @click="limit += CATALOG_PAGE_SIZE"
        >
          {{ $t("show_more") }}
        </Button>
      </div>
    </template>
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
</template>

<script setup lang="ts">
import CatalogCard from "@/components/settings/catalog/CatalogCard.vue";
import CatalogGrid from "@/components/settings/catalog/CatalogGrid.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  type CatalogBadge,
  getReleaseLine,
  sortSuggestedFirst,
} from "@/helpers/catalog_recommendations";
import {
  CATALOG_PAGE_SIZE,
  type CatalogEntry,
  type CatalogType,
  filterCatalogEntries,
  getTypeSettingsRoute,
} from "@/helpers/provider_catalog";
import type { ProviderLabel } from "@/helpers/provider_labels";
import { api } from "@/plugins/api";
import { $t } from "@/plugins/i18n";
import { ChevronRight, SearchX } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { RouterLink } from "vue-router";

interface Props {
  // the entries to list, before the search and the filters
  entries: CatalogEntry[];
  query: string;
  // the stages picked to filter on; none for every stage
  stages: readonly string[];
  // the label picked to filter on; null for All
  label: ProviderLabel | null;
  // the type listed, for the link to its settings page; none for every type
  type?: CatalogType;
  // the domains being installed from the community catalog
  installing: ReadonlySet<string>;
  // why an entry is suggested, by its domain; these lead the list
  badges: ReadonlyMap<string, CatalogBadge>;
}

const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "open", entry: CatalogEntry): void;
  (e: "add", entry: CatalogEntry): void;
}>();

const limit = ref(CATALOG_PAGE_SIZE);

const matches = computed(() =>
  sortSuggestedFirst(
    filterCatalogEntries(props.entries, {
      query: props.query,
      stages: props.stages,
      label: props.label,
    }),
    props.badges,
  ),
);

const heading = computed(() =>
  props.type ? $t(props.type.label) : $t("settings.catalog.search_results"),
);

const summary = computed(() =>
  props.type
    ? $t("settings.catalog.to_choose_from", { count: matches.value.length })
    : $t("settings.catalog.search_results"),
);

const shown = computed(() => matches.value.slice(0, limit.value));

// the release line of the server, which names what is new in it
const releaseLine = computed(() =>
  getReleaseLine(api.serverInfo.value?.server_version ?? ""),
);

const getBadgeLabel = (entry: CatalogEntry) => {
  const badge = props.badges.get(entry.manifest.domain);
  return badge ? $t(badge.label, { version: releaseLine.value }) : undefined;
};

// another search or filter starts again at the first page
watch([() => props.query, () => props.stages, () => props.label], () => {
  limit.value = CATALOG_PAGE_SIZE;
});
</script>
