<template>
  <section
    :class="
      cn(
        'px-7 pt-7 pb-16 text-foreground max-md:px-4 max-md:pt-4',
        store.mobileLayout && 'pb-0',
      )
    "
  >
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
            {{
              $t(
                includesOtherUsers
                  ? "statistics_subtitle_other_users"
                  : "statistics_subtitle",
              )
            }}
          </p>
        </div>
        <StatisticsUserSelect
          v-if="canSelectUsers"
          v-model="users"
          :users="allUsers"
        />
        <StatisticsPeriodSelect v-model="period" />
      </header>

      <StatisticsHeroCard
        :points="data.playsOverTime"
        :period="period"
        :loading="loading"
        :error="failed.has('playsOverTime')"
        :peak-hour="peakHour"
        :includes-other-users="includesOtherUsers"
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
          :includes-other-users="includesOtherUsers"
        />
        <StatisticsListeningWindowCard
          :activity="data.listeningActivity"
          :loading="loading"
          :error="failed.has('listeningActivity')"
          :includes-other-users="includesOtherUsers"
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
          class="flex-[2_1_360px] px-6 py-5"
          :listening-time="data.listeningTime"
          :loading="loading"
          :error="failed.has('listeningTime')"
        />
        <ListeningHeatmapCard
          class="flex-[3_1_520px] px-6 py-5"
          :data="data.listeningActivity"
          :loading="loading"
          :error="failed.has('listeningActivity')"
          :includes-other-users="includesOtherUsers"
        />
      </div>

      <StatisticsMostPlayed
        class="mt-2"
        :tracks="data.topTracks"
        :loading="loading"
        :error="failed.has('topTracks')"
      />

      <StatisticsTopItemsTable
        :active="usersReady"
        :period="period"
        :users="shownUsers"
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
import StatisticsUserSelect from "@/components/statistics/StatisticsUserSelect.vue";
import { Button } from "@/components/ui/button";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { useStatistics, useStatisticsUsers } from "@/composables/useStatistics";
import { goBack } from "@/helpers/navigation";
import { cn } from "@/lib/utils";
import {
  hourlyTotals,
  peakListeningWindow,
} from "@/helpers/statistics_activity";
import { summarizePlays } from "@/helpers/statistics_time_series";
import {
  Scope,
  type StatisticsPeriod,
  type StatisticsUsers,
} from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { store } from "@/plugins/store";
import { ArrowLeft } from "@lucide/vue";
import { computed, ref, watch } from "vue";
import { useRoute, useRouter } from "vue-router";
import { toast } from "vue-sonner";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  period: StatisticsPeriod;
  users?: StatisticsUsers;
}>();

const router = useRouter();
const route = useRoute();
const period = ref<StatisticsPeriod>(props.period);
// the period and users live in the url, so back and reload keep them
watch(
  () => props.period,
  (value) => (period.value = value),
);
watch(period, (value) => {
  if (value !== props.period) {
    void router.replace({ query: { ...route.query, period: value } });
  }
});
const users = computed({
  get: () => props.users ?? {},
  set: (value: StatisticsUsers) =>
    void router.replace({
      query: {
        ...route.query,
        users: value.users?.length ? value.users.join(",") : undefined,
        all_users: value.all_users ? "true" : undefined,
      },
    }),
});
const canSelectUsers = computed(() =>
  authManager.hasScope(Scope.USERS_IMPERSONATE),
);
const shownUsers = computed(() => (canSelectUsers.value ? users.value : {}));
// "you" and "your" only fit the current user's own statistics
const includesOtherUsers = computed(
  () =>
    shownUsers.value.all_users === true ||
    (shownUsers.value.users ?? []).some(
      (id) => id !== store.currentUser?.user_id,
    ),
);

const { users: allUsers, loaded: usersLoaded } =
  useStatisticsUsers(canSelectUsers);
const findUser = (reference: string) =>
  allUsers.value.find(
    (user) =>
      user.user_id === reference ||
      user.username === reference.trim().toLowerCase(),
  );
// a link can name users that were deleted since, or name them by username
watch(
  [allUsers, () => users.value.users],
  ([list, references]) => {
    if (!list.length || !references?.length) return;
    const known = references.flatMap((reference) => {
      const user = findUser(reference);
      return user ? [user.user_id] : [];
    });
    if (known.length < references.length) {
      toast.warning($t("statistics_users_removed"));
    }
    if (known.join(",") !== references.join(",")) {
      users.value = known.length ? { users: known } : {};
    }
  },
  { immediate: true },
);
// held back until the users of a link are checked, so an unknown one does not
// fail every section first
const usersReady = computed(() => {
  const references = shownUsers.value.users;
  if (!references?.length) return true;
  if (!usersLoaded.value) return false;
  return (
    !allUsers.value.length ||
    references.every((reference) => findUser(reference)?.user_id === reference)
  );
});

const {
  data,
  failed,
  loading: statisticsLoading,
} = useStatistics({
  active: usersReady,
  period,
  users: shownUsers,
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
const loading = computed(() => statisticsLoading.value || !usersReady.value);

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
