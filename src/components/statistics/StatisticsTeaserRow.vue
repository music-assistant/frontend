<template>
  <section class="px-[28px] max-[600px]:px-4">
    <div class="mb-3.5 flex flex-wrap items-center justify-between gap-3">
      <h2 class="m-0 text-[22px] font-bold tracking-[-0.4px] text-foreground">
        {{ $t("statistics") }}
      </h2>
      <div class="flex flex-wrap items-center gap-2">
        <StatisticsPeriodSelect v-model="period" hide-label />
        <Button as-child variant="ghost" size="sm">
          <RouterLink
            :to="{ name: 'statistics', query: { period } }"
            class="text-foreground no-underline"
          >
            {{ $t("statistics_all") }}
            <ChevronRight aria-hidden="true" />
          </RouterLink>
        </Button>
        <slot name="edit-controls"></slot>
      </div>
    </div>
    <StatisticsHeroCard
      :points="data.playsOverTime"
      :period="period"
      :loading="loading"
      :error="failed.has('playsOverTime')"
    >
      <template #highlights>
        <p
          v-if="!loading && highlightsFailed && !failed.has('playsOverTime')"
          role="alert"
          class="m-0 mt-2.5 text-sm text-muted-foreground"
        >
          {{ $t("statistics_section_failed") }}
        </p>
        <div
          v-if="loading || visibleHighlights.length"
          data-testid="statistics-highlights"
          class="ma-scroll mt-2.5 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [--ed-tile-art:80px]"
        >
          <div
            v-for="highlight in loading ? highlights : visibleHighlights"
            :key="highlight.section"
            class="w-24 shrink-0"
          >
            <EditorialCardSkeleton v-if="loading" />
            <EditorialMediaCard
              v-else-if="highlight.item"
              :item="highlight.item"
              :is-available="itemIsAvailable(highlight.item)"
              :disabled="!connected"
              :disable-play-button="playActionInProgress"
            >
              <template #subtitle>{{ highlight.label }}</template>
            </EditorialMediaCard>
          </div>
        </div>
      </template>
    </StatisticsHeroCard>
  </section>
</template>

<script setup lang="ts">
import StatisticsHeroCard from "@/components/statistics/StatisticsHeroCard.vue";
import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import EditorialMediaCard from "@/components/discover/EditorialMediaCard.vue";
import EditorialCardSkeleton from "@/components/discover/EditorialCardSkeleton.vue";
import { Button } from "@/components/ui/button";
import {
  useStatistics,
  type StatisticsSection,
} from "@/composables/useStatistics";
import { useMediaPlayState } from "@/composables/useMediaPlayState";
import { setUserPreference } from "@/composables/userPreferences";
import { parseStatisticsPeriod } from "@/helpers/statistics_period";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { ItemMapping, StatisticsPeriod } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ChevronRight } from "@lucide/vue";
import { computed, ref, toRef, watch } from "vue";
import { RouterLink } from "vue-router";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  // false while the row is hidden, so nothing is requested for it
  active: boolean;
}>();

const PERIOD_PREFERENCE_KEY = "discover.statisticsPeriod";

const period = ref<StatisticsPeriod>(
  parseStatisticsPeriod(
    store.currentUser?.preferences?.[PERIOD_PREFERENCE_KEY],
  ),
);
watch(period, (value) => void setUserPreference(PERIOD_PREFERENCE_KEY, value));
const { data, failed, loading } = useStatistics({
  active: toRef(props, "active"),
  period,
  sections: ["playsOverTime", "topArtists", "topAlbums", "topTracks"],
  topItemsLimit: 1,
});

interface Highlight {
  section: Extract<StatisticsSection, "topArtists" | "topAlbums" | "topTracks">;
  label: string;
  item?: ItemMapping;
}

const highlights = computed<Highlight[]>(() => [
  {
    section: "topArtists",
    label: $t("statistics_highlight_artist"),
    item: data.value.topArtists[0]?.item,
  },
  {
    section: "topAlbums",
    label: $t("statistics_highlight_album"),
    item: data.value.topAlbums[0]?.item,
  },
  {
    section: "topTracks",
    label: $t("statistics_highlight_track"),
    item: data.value.topTracks[0]?.item,
  },
]);

const visibleHighlights = computed(() =>
  highlights.value.filter(
    (highlight) => highlight.item && !failed.value.has(highlight.section),
  ),
);
const highlightsFailed = computed(() =>
  highlights.value.some((highlight) => failed.value.has(highlight.section)),
);
const { connected, playActionInProgress } = useMediaPlayState();
</script>
