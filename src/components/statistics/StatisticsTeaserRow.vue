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
    />
  </section>
</template>

<script setup lang="ts">
import StatisticsHeroCard from "@/components/statistics/StatisticsHeroCard.vue";
import StatisticsPeriodSelect from "@/components/statistics/StatisticsPeriodSelect.vue";
import { Button } from "@/components/ui/button";
import { useStatistics } from "@/composables/useStatistics";
import { setUserPreference } from "@/composables/userPreferences";
import { parseStatisticsPeriod } from "@/helpers/statistics_period";
import type { StatisticsPeriod } from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { ChevronRight } from "@lucide/vue";
import { ref, toRef, watch } from "vue";
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
  sections: ["playsOverTime"],
});
</script>
