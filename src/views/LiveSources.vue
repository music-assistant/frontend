<template>
  <section class="flex min-h-full flex-1 flex-col">
    <!-- spaced as the headers of the other listings -->
    <header class="flex h-[55px] shrink-0 items-center ps-[30px] pe-[11px]">
      <AudioLines class="size-6 shrink-0 opacity-80" aria-hidden="true" />
      <div
        class="ms-[23px] flex min-w-0 flex-1 flex-col justify-center leading-[1.2]"
      >
        <h1 class="m-0 flex items-baseline text-xl leading-6 font-normal">
          {{ $t("live_sources") }}
          <span
            v-if="player && !loading && !failed"
            class="ms-2 text-base text-muted-foreground"
          >
            {{ sources.length }}
          </span>
        </h1>
        <p v-if="subtitle" class="m-0 truncate text-[0.7rem] opacity-60">
          {{ subtitle }}
        </p>
      </div>
      <ListingSortMenu
        :options="[]"
        sort-by=""
        :view-mode="viewMode"
        :grid-controls="gridControls"
        :compact="store.mobileLayout"
        @view-mode="selectViewMode"
      />
    </header>
    <Separator />

    <div
      class="p-2.5"
      :class="{ 'bg-background dark:bg-transparent': viewMode !== 'list' }"
    >
      <Empty v-if="!player" class="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Speaker />
          </EmptyMedia>
          <EmptyTitle>{{ $t("no_player") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("live_sources_page.no_player") }}
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" @click="selectPlayer">
            {{ $t("live_sources_page.select_player") }}
          </Button>
        </EmptyContent>
      </Empty>

      <template v-else-if="loading && !sources.length">
        <div v-if="viewMode === 'list'">
          <ListViewSkeleton v-for="n in SKELETON_COUNT" :key="n" />
        </div>
        <div v-else :class="GRID_CLASS" :style="gridStyle">
          <PanelViewSkeleton v-for="n in SKELETON_COUNT" :key="n" />
        </div>
      </template>

      <Empty v-else-if="failed" class="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <TriangleAlert />
          </EmptyMedia>
          <EmptyTitle>{{ $t("items_load_failed") }}</EmptyTitle>
        </EmptyHeader>
        <EmptyContent>
          <Button variant="outline" size="sm" @click="reload">
            {{ $t("settings.retry") }}
          </Button>
        </EmptyContent>
      </Empty>

      <Empty v-else-if="!sources.length" class="border-none">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <AudioLines />
          </EmptyMedia>
          <EmptyTitle>{{ $t("live_sources_page.empty") }}</EmptyTitle>
          <EmptyDescription>
            {{ $t("live_sources_page.empty_description", [playerName]) }}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>

      <div v-else-if="viewMode === 'list'">
        <LiveSourceListItem
          v-for="source in sources"
          :key="source.id"
          v-bind="rowProps(source)"
          @start="start(source)"
          @menu="(evt: Event) => openMenu(source, evt)"
        />
      </div>

      <div v-else ref="gridEl" :class="GRID_CLASS" :style="gridStyle">
        <LiveSourceCard
          v-for="source in sources"
          :key="source.id"
          v-bind="rowProps(source)"
          :show-actions="showActions"
          @start="start(source)"
          @menu="(evt: Event) => openMenu(source, evt)"
        />
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import LiveSourceCard from "@/components/live-sources/LiveSourceCard.vue";
import LiveSourceListItem from "@/components/live-sources/LiveSourceListItem.vue";
import ListingSortMenu from "@/components/listing-toolbar/ListingSortMenu.vue";
import ListViewSkeleton from "@/components/skeletons/ListViewSkeleton.vue";
import PanelViewSkeleton from "@/components/skeletons/PanelViewSkeleton.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Separator } from "@/components/ui/separator";
import {
  openLiveSourceMenu,
  startLiveSource,
  useLiveSources,
} from "@/composables/useLiveSources";
import { useListingView } from "@/composables/useListingView";
import {
  getLiveSourceIcon,
  getLiveSourceOwnerName,
} from "@/helpers/live_sources";
import { getPlayerName } from "@/helpers/players";
import { api } from "@/plugins/api";
import { PlaybackState, type PlayerSource } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { AudioLines, Speaker, TriangleAlert } from "@lucide/vue";
import { computed } from "vue";

defineOptions({
  name: "LiveSources",
});

const SKELETON_COUNT = 4;
// the gaps and edges of the panel view of the other listings
const GRID_CLASS = "-m-1 grid gap-4";

const player = computed(() => store.activePlayer);
const playerName = computed(() =>
  player.value ? getPlayerName(player.value) : "",
);
const subtitle = computed(() =>
  player.value
    ? $t("live_sources_page.plays_on", [playerName.value])
    : undefined,
);

const { sources, loading, failed, reload } = useLiveSources(
  () => player.value?.player_id,
);

const {
  viewMode,
  selectViewMode,
  columnCount,
  gridControls,
  showActions,
  gridEl,
} = useListingView("livesources");
const gridStyle = computed(() => ({
  gridTemplateColumns: `repeat(${columnCount.value}, minmax(0, 1fr))`,
}));

const rowProps = (source: PlayerSource) => ({
  source,
  icon: getLiveSourceIcon(source),
  ownerName: getLiveSourceOwnerName(source, api.players),
  isPlaying:
    player.value?.active_source === source.id &&
    player.value.playback_state === PlaybackState.PLAYING,
});

const start = (source: PlayerSource) => {
  if (player.value) void startLiveSource(player.value.player_id, source);
};

const openMenu = (source: PlayerSource, evt: Event) => {
  // a long-press is a touch, a right-click or the menu button a mouse event
  const point =
    "touches" in evt ? (evt as TouchEvent).touches[0] : (evt as MouseEvent);
  openLiveSourceMenu(
    source,
    player.value?.player_id,
    point?.clientX ?? 0,
    point?.clientY ?? 0,
  );
};

const selectPlayer = () => {
  store.showPlayersMenu = true;
};
</script>
