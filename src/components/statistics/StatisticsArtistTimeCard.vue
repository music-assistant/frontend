<template>
  <StatisticsCard
    prominent
    :title="$t('statistics_artist_time')"
    :subtitle="$t('statistics_artist_time_subtitle')"
    :loading="loading"
    :error="error"
    :empty="rows.length === 0"
    :empty-text="$t('statistics_listening_time_empty')"
    min-height-class="min-h-[280px]"
  >
    <ul
      class="m-0 flex list-none flex-col gap-2 p-0"
      :aria-label="$t('statistics_artist_time')"
    >
      <li v-for="row in rows" :key="row.name" class="flex items-center gap-3">
        <component
          :is="row.artist ? 'button' : 'span'"
          :type="row.artist ? 'button' : undefined"
          class="relative flex h-[34px] min-w-0 flex-1 items-center border-0 bg-transparent p-0 text-left text-foreground"
          :class="
            row.artist
              ? 'cursor-pointer hover:[&>.bar-label]:underline focus-visible:outline-2 focus-visible:outline-primary'
              : ''
          "
          @click="row.artist && openArtist(row.artist, $event)"
        >
          <span
            class="absolute inset-y-0 left-0 rounded-md"
            :class="row.barClass"
            :style="{ width: `${row.width}%` }"
            aria-hidden="true"
          ></span>
          <span
            class="bar-label relative truncate pl-3 text-[13px] font-medium"
            >{{ row.name }}</span
          >
        </component>
        <span
          class="w-16 shrink-0 text-right text-[13px] text-muted-foreground tabular-nums"
        >
          {{ row.minutesLabel }}
        </span>
      </li>
    </ul>
  </StatisticsCard>
</template>

<script setup lang="ts">
import StatisticsCard from "@/components/statistics/StatisticsCard.vue";
import { useCanonicalLocale } from "@/composables/useCanonicalLocale";
import { handleMediaItemClick } from "@/helpers/media_item_actions";
import { formatCount } from "@/helpers/statistics_format";
import { findByName, sharePercent } from "@/helpers/statistics_rankings";
import type {
  ItemMapping,
  StatisticsListeningTimeItem,
  StatisticsTopItemResult,
} from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { computed } from "vue";

const props = defineProps<{
  listeningTime: StatisticsListeningTimeItem[];
  // ranked artists, to link a row to its artist page by name
  topArtists: StatisticsTopItemResult[];
  loading?: boolean;
  error?: boolean;
}>();

interface ArtistTimeRow {
  name: string;
  minutesLabel: string;
  width: number;
  barClass: string;
  artist?: ItemMapping;
}

// the longest bar strongest, fading down the list
const BAR_CLASSES = [
  "bg-primary/90",
  "bg-primary/75",
  "bg-primary/60",
  "bg-primary/50",
  "bg-primary/40",
  "bg-primary/30",
  "bg-primary/25",
];

const locale = useCanonicalLocale();
const rows = computed<ArtistTimeRow[]>(() => {
  const longest = props.listeningTime[0]?.minutes ?? 0;
  return props.listeningTime.map((entry, index) => {
    const minutes = Math.round(entry.minutes);
    return {
      name: entry.name,
      minutesLabel: $t("statistics_minutes", minutes, {
        named: { count: formatCount(minutes, locale.value) },
      }),
      width: sharePercent(entry.minutes, longest),
      barClass: BAR_CLASSES[Math.min(index, BAR_CLASSES.length - 1)],
      artist: findByName(entry.name, props.topArtists, (top) => top.item.name)
        ?.item,
    };
  });
});

function openArtist(artist: ItemMapping, event: MouseEvent): void {
  handleMediaItemClick(artist, event.clientX, event.clientY);
}
</script>
