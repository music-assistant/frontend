<template>
  <StatisticsCard
    prominent
    :title="$t(TABS[activeTab])"
    :loading="loading"
    :error="error"
    :empty="items.length === 0"
    min-height-class="min-h-[240px]"
    class="gap-3 px-6 py-5"
  >
    <template #header>
      <Tabs v-model="activeTab">
        <TabsList :aria-label="$t('statistics_top_items')">
          <!-- Vuetify's own .border colours the trigger's transparent border;
               the state variant outranks it -->
          <TabsTrigger
            v-for="(_, mediaType) in TABS"
            :key="mediaType"
            :value="mediaType"
            class="px-3 text-[13px] data-[state=inactive]:border-transparent"
          >
            {{ $t(TAB_LABELS[mediaType]) }}
          </TabsTrigger>
        </TabsList>
      </Tabs>
    </template>
    <Table class="min-w-[480px] text-sm">
      <TableHeader>
        <TableRow class="hover:bg-transparent">
          <TableHead class="w-9 text-xs text-muted-foreground">
            {{ $t("statistics_column_rank") }}
          </TableHead>
          <TableHead class="text-xs text-muted-foreground">
            {{ $t("statistics_column_title") }}
          </TableHead>
          <TableHead class="text-right text-xs text-muted-foreground">
            {{ $t("statistics_plays_label") }}
          </TableHead>
          <TableHead class="w-40 text-xs text-muted-foreground">
            {{ $t("statistics_column_share") }}
          </TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        <TableRow v-for="(entry, index) in items" :key="entry.item.uri">
          <TableCell class="py-2.5 text-muted-foreground tabular-nums">
            {{ index + 1 }}
          </TableCell>
          <TableCell class="max-w-0 py-2.5">
            <button
              type="button"
              class="flex w-full min-w-0 items-center gap-3 border-0 bg-transparent p-0 text-left text-foreground hover:underline focus-visible:outline-2 focus-visible:outline-primary"
              :class="{ 'opacity-50': !itemIsAvailable(entry.item) }"
              @click="openItem(entry, $event)"
            >
              <span class="size-10 shrink-0 overflow-hidden rounded-md">
                <MediaItemThumb :item="entry.item" :size="THUMB_SIZE" alt="" />
              </span>
              <span class="truncate font-medium">{{ entry.item.name }}</span>
            </button>
          </TableCell>
          <TableCell class="py-2.5 text-right tabular-nums">
            {{ formatCount(entry.play_count, locale) }}
          </TableCell>
          <TableCell class="py-2.5">
            <span
              class="block h-1.5 rounded-full bg-muted"
              role="img"
              :aria-label="
                $t('statistics_share_accessible', {
                  share: shareOfTop(entry),
                })
              "
            >
              <span
                class="block h-full rounded-full bg-primary"
                :style="{ width: `${shareOfTop(entry)}%` }"
              ></span>
            </span>
          </TableCell>
        </TableRow>
      </TableBody>
    </Table>
  </StatisticsCard>
</template>

<script setup lang="ts">
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import {
  useStatisticsTopItems,
  type TopItemsMediaType,
} from "@/composables/useStatistics";
import { handleMediaItemClick } from "@/helpers/media_item_actions";
import { formatCount } from "@/helpers/statistics_format";
import { sharePercent } from "@/helpers/statistics_rankings";
import { itemIsAvailable } from "@/plugins/api/helpers";
import {
  MediaType,
  type StatisticsPeriod,
  type StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { computed, ref, toRef } from "vue";
import { $t } from "@/plugins/i18n";

const props = defineProps<{
  active: boolean;
  period: StatisticsPeriod;
  // the page already loads the top tracks, so that tab reuses them
  tracks: StatisticsTopItemResult[];
  tracksLoading?: boolean;
  tracksError?: boolean;
}>();

const THUMB_SIZE = 40;
// table title per tab
const TABS: Record<TopItemsMediaType, string> = {
  [MediaType.TRACK]: "statistics_top_tracks",
  [MediaType.ALBUM]: "statistics_top_albums",
  [MediaType.ARTIST]: "statistics_top_artists",
  [MediaType.PLAYLIST]: "statistics_top_playlists",
};
const TAB_LABELS: Record<TopItemsMediaType, string> = {
  [MediaType.TRACK]: "tracks",
  [MediaType.ALBUM]: "albums",
  [MediaType.ARTIST]: "artists",
  [MediaType.PLAYLIST]: "playlists",
};

const locale = useCanonicalLocale();
const activeTab = ref<TopItemsMediaType>(MediaType.TRACK);
const isTrackTab = computed(() => activeTab.value === MediaType.TRACK);
const otherTab = useStatisticsTopItems({
  active: computed(() => props.active && !isTrackTab.value),
  period: toRef(props, "period"),
  mediaType: activeTab,
});

const items = computed(() =>
  isTrackTab.value ? props.tracks : otherTab.items.value,
);
const loading = computed(() =>
  isTrackTab.value ? props.tracksLoading : otherTab.loading.value,
);
const error = computed(() =>
  isTrackTab.value ? props.tracksError : otherTab.error.value,
);
const topPlays = computed(() => items.value[0]?.play_count ?? 0);

const shareOfTop = (entry: StatisticsTopItemResult): number =>
  sharePercent(entry.play_count, topPlays.value);

function openItem(entry: StatisticsTopItemResult, event: MouseEvent): void {
  handleMediaItemClick(entry.item, event.clientX, event.clientY);
}
</script>
