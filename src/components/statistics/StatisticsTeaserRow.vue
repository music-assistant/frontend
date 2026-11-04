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
        <div
          class="ma-scroll mt-2.5 flex min-w-0 gap-2 overflow-x-auto overscroll-x-contain pb-1 [--ed-tile-art:80px]"
        >
          <div
            v-for="highlight in highlights"
            :key="highlight.section"
            class="w-24 shrink-0"
          >
            <EditorialCardSkeleton v-if="loading" />
            <p
              v-else-if="failed.has(highlight.section)"
              role="alert"
              class="m-0 text-sm text-muted-foreground"
            >
              {{ highlight.label }}: {{ $t("statistics_section_failed") }}
            </p>
            <EditorialMediaCard
              v-else-if="highlight.item"
              :item="highlight.item"
              :is-available="itemIsAvailable(highlight.item)"
              :disabled="!connected"
              :disable-play-button="playActionInProgress"
            >
              <template #subtitle>{{ highlight.label }}</template>
            </EditorialMediaCard>
            <p v-else class="m-0 text-sm text-muted-foreground">
              {{ highlight.label }}: {{ $t("statistics_section_empty") }}
            </p>
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
import { useStatistics } from "@/composables/useStatistics";
import { setUserPreference } from "@/composables/userPreferences";
import { parseStatisticsPeriod } from "@/helpers/statistics_period";
import api, { ConnectionState } from "@/plugins/api";
import { itemIsAvailable } from "@/plugins/api/helpers";
import type { StatisticsPeriod } from "@/plugins/api/interfaces";
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

const highlights = computed(() => [
  {
    section: "topArtists" as const,
    label: $t("statistics_top_artist_short"),
    item: data.value.topArtists[0]?.item,
  },
  {
    section: "topAlbums" as const,
    label: $t("statistics_top_album"),
    item: data.value.topAlbums[0]?.item,
  },
  {
    section: "topTracks" as const,
    label: $t("statistics_top_track"),
    item: data.value.topTracks[0]?.item,
  },
]);

const connected = computed(
  () => api.state.value === ConnectionState.INITIALIZED,
);
const playActionInProgress = computed(() => {
  const player = store.activePlayer;
  if (!player) return false;
  const queueId =
    player.active_source && player.active_source in api.queues
      ? player.active_source
      : player.player_id;
  return (
    api.queues[queueId]?.extra_attributes?.play_action_in_progress === true
  );
});
</script>
