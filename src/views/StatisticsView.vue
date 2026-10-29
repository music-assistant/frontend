<template>
  <section class="px-7 pt-7 pb-16 text-foreground max-md:px-4 max-md:pt-4">
    <div class="mx-auto flex max-w-[1320px] flex-col gap-4">
      <header class="flex flex-wrap items-center gap-3">
        <Button
          variant="ghost"
          size="icon"
          :aria-label="$t('back')"
          @click="navigateBack"
        >
          <ArrowLeft class="size-[22px]" aria-hidden="true" />
        </Button>
        <div class="flex flex-[1_1_280px] flex-col gap-0.5">
          <h1 class="m-0 text-[28px] font-bold">{{ $t("statistics") }}</h1>
          <p class="m-0 text-sm text-muted-foreground">
            {{ $t("statistics_subtitle") }}
          </p>
        </div>
        <StatisticsPeriodSelect v-model="period" />
      </header>

      <StatisticsHeroCard
        :points="data.playsOverTime"
        :period="period"
        :loading="loading"
        :error="failed.has('playsOverTime')"
        :peak-hour="peakHour"
      />

      <!-- two by two until all four fit in a row, so none sits alone -->
      <div
        class="grid grid-cols-1 gap-4 sm:grid-cols-2 min-[1600px]:grid-cols-4"
      >
        <StatisticsTopArtistCard
          :top-artists="data.topArtists"
          :total-plays="totalPlays"
          :listening-time="data.listeningTime"
          :loading="loading"
          :error="failed.has('topArtists')"
        />
        <StatisticsListeningWindowCard
          :activity="data.listeningActivity"
          :loading="loading"
          :error="failed.has('listeningActivity')"
        />
        <StatisticsGenreCard
          :genres="data.genreDistribution"
          :loading="loading"
          :error="failed.has('genreDistribution')"
        />
        <StatisticsDecadeCard
          :decades="data.decadeDistribution"
          :loading="loading"
          :error="failed.has('decadeDistribution')"
        />
      </div>

      <div class="flex flex-wrap gap-4">
        <StatisticsArtistTimeCard
          class="flex-[2_1_460px] px-6 py-5"
          :listening-time="data.listeningTime"
          :loading="loading"
          :error="failed.has('listeningTime')"
        />
        <ListeningHeatmapCard
          class="flex-[3_1_560px] px-6 py-5"
          :data="data.listeningActivity"
          :loading="loading"
          :error="failed.has('listeningActivity')"
        />
      </div>

      <StatisticsMostPlayed
        class="mt-2"
        :tracks="data.topTracks"
        :loading="loading"
        :error="failed.has('topTracks')"
      />

      <StatisticsTopItemsTable
        :active="active"
        :period="period"
        :tracks="data.topTracks"
        :tracks-loading="loading"
        :tracks-error="failed.has('topTracks')"
      />
    </div>
  </section>
</template>

<script setup lang="ts">
import ListeningHeatmapCard from "@/components/statistics/ListeningHeatmapCard.vue";
import StatisticsArtistTimeCard from "@/components/statistics/StatisticsArtistTimeCard.vue";
import StatisticsDecadeCard from "@/components/statistics/StatisticsDecadeCard.vue";
import StatisticsGenreCard from "@/components/statistics/StatisticsGenreCard.vue";
import StatisticsHeroCard from "@/components/statistics/StatisticsHeroCard.vue";
import StatisticsListeningWindowCard from "@/components/statistics/StatisticsListeningWindowCard.vue";
import StatisticsMostPlayed from "@/components/statistics/StatisticsMostPlayed.vue";
import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import StatisticsTopArtistCard from "@/components/statistics/StatisticsTopArtistCard.vue";
import StatisticsTopItemsTable from "@/components/statistics/StatisticsTopItemsTable.vue";
import { Button } from "@/components/ui/button";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { useStatistics } from "@/composables/useStatistics";
import { goBack } from "@/helpers/navigation";
import {
  hourlyTotals,
  peakListeningWindow,
} from "@/helpers/statistics_activity";
import { summarizePlays } from "@/helpers/statistics_time_series";
import type { StatisticsPeriod } from "@/plugins/api/interfaces";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  period: StatisticsPeriod;
}>();

const router = useRouter();
const active = ref(true);
const period = ref<StatisticsPeriod>(props.period);

// the period lives in the url, so back and reload keep it
watch(
  () => props.period,
  (value) => (period.value = value),
);
watch(period, (value) => {
  if (value !== props.period) {
    void router.replace({ query: { period: value } });
  }
});

const { data, failed, loading } = useStatistics({
  active,
  period,
  sections: [
    "playsOverTime",
    "topTracks",
    "topArtists",
    "listeningActivity",
    "listeningTime",
    "genreDistribution",
    "decadeDistribution",
  ],
});

const totalPlays = computed(
  () => summarizePlays(data.value.playsOverTime).total,
);
// the single busiest hour of the day
const peakHour = computed(
  () =>
    peakListeningWindow(hourlyTotals(data.value.listeningActivity), 1)
      ?.startHour,
);

const navigateBack = () => goBack(router, { name: "discover" });
useEscapeBack(navigateBack);
</script>
