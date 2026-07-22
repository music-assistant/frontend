<template>
  <section>
    <Toolbar
      :icon="ArrowLeft"
      :icon-action="goBack"
      :title="$t('latest_episodes')"
      color="transparent"
      :menu-items="toolbarMenuItems"
    />

    <Separator />

    <Container variant="default">
      <!-- controls: search, unplayed-only toggle, refresh -->
      <div class="mb-3 flex flex-wrap items-center gap-3">
        <SearchInput
          v-model="searchQuery"
          clearable
          class="min-w-[200px] flex-1"
          :placeholder="$t('search')"
          :aria-label="$t('search')"
        />
        <label
          class="flex cursor-pointer items-center gap-2 text-sm select-none"
        >
          <Switch
            v-model="unplayedOnly"
            :aria-label="$t('latest_episodes_unplayed_only')"
          />
          <span>{{ $t("latest_episodes_unplayed_only") }}</span>
        </label>
        <Button
          variant="outline"
          size="sm"
          :disabled="isLoading"
          @click="refresh"
        >
          <RefreshCw class="h-4 w-4" :class="{ 'animate-spin': isLoading }" />
          {{ $t("refresh") }}
        </Button>
      </div>

      <!-- loading progress -->
      <div
        v-if="isLoading && progress.total > 0"
        class="mb-4 flex flex-col gap-2"
        role="status"
        aria-live="polite"
      >
        <Progress :model-value="progressPercent" />
        <span class="text-sm opacity-70">
          {{
            $t("latest_episodes_loading_progress", [
              String(progress.loaded),
              String(progress.total),
            ])
          }}
        </span>
      </div>

      <!-- partial-failure banner (single meaningful state) -->
      <div
        v-if="hasPartialFailure && !isLoading"
        class="mb-4 flex items-center gap-2 rounded-md border border-yellow-500/40 bg-yellow-500/10 px-3 py-2 text-sm text-yellow-600 dark:text-yellow-400"
        role="alert"
      >
        <TriangleAlert class="h-4 w-4 shrink-0" />
        <span>{{
          $t("latest_episodes_partial_failure", [String(failedFeedCount)])
        }}</span>
      </div>

      <!-- loading skeletons on first load -->
      <div v-if="isLoading && episodes.length === 0">
        <ListViewSkeleton v-for="n in 8" :key="`latest-skeleton-${n}`" />
      </div>

      <!-- hard failure state -->
      <Empty v-else-if="loadFailed" class="border-none gap-3 py-8">
        <EmptyMedia variant="icon">
          <TriangleAlert class="h-5 w-5" />
        </EmptyMedia>
        <EmptyDescription>
          {{ $t("latest_episodes_load_failed") }}
        </EmptyDescription>
        <EmptyContent>
          <Button variant="outline" size="sm" @click="refresh">
            {{ $t("refresh") }}
          </Button>
        </EmptyContent>
      </Empty>

      <!-- empty state -->
      <Empty
        v-else-if="visibleEpisodes.length === 0"
        class="border-none gap-3 py-8"
      >
        <EmptyMedia variant="icon">
          <Podcast class="h-5 w-5" />
        </EmptyMedia>
        <EmptyDescription>
          {{ hasActiveFilters ? $t("no_content_filter") : $t("no_content") }}
        </EmptyDescription>
      </Empty>

      <!-- episode list -->
      <div v-else class="flex flex-col">
        <LatestPodcastEpisodeItem
          v-for="episode in visibleEpisodes"
          :key="episodeKey(episode)"
          :episode="episode"
        />
      </div>
    </Container>
  </section>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from "vue";
import { useRouter } from "vue-router";
import { ArrowLeft, Podcast, RefreshCw, TriangleAlert } from "@lucide/vue";
import Container from "@/components/Container.vue";
import Toolbar, { type ToolBarMenuItem } from "@/components/Toolbar.vue";
import LatestPodcastEpisodeItem from "@/components/LatestPodcastEpisodeItem.vue";
import ListViewSkeleton from "@/components/skeletons/ListViewSkeleton.vue";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyMedia,
} from "@/components/ui/empty";
import { Progress } from "@/components/ui/progress";
import { SearchInput } from "@/components/ui/search-input";
import { Separator } from "@/components/ui/separator";
import { Switch } from "@/components/ui/switch";
import { useLatestPodcastEpisodes } from "@/composables/useLatestPodcastEpisodes";
import { getEpisodeIdentity } from "@/helpers/podcast_latest";
import { api } from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import type { EventMessage, PodcastEpisode } from "@/plugins/api/interfaces";

defineOptions({
  name: "LatestPodcastEpisodes",
});

const router = useRouter();

const {
  episodes,
  isLoading,
  loadFailed,
  failedFeedCount,
  progress,
  hasPartialFailure,
  load,
  refresh,
  applyPlaybackUpdate,
} = useLatestPodcastEpisodes();

const searchQuery = ref("");
const unplayedOnly = ref(false);

const hasActiveFilters = computed(
  () => searchQuery.value.trim().length > 0 || unplayedOnly.value,
);

const progressPercent = computed(() => {
  if (progress.value.total === 0) return 0;
  return Math.round((progress.value.loaded / progress.value.total) * 100);
});

const visibleEpisodes = computed<PodcastEpisode[]>(() => {
  const query = searchQuery.value.trim().toLowerCase();
  return episodes.value.filter((episode) => {
    if (unplayedOnly.value && episode.fully_played) return false;
    if (!query) return true;
    const title = episode.name.toLowerCase();
    const podcastName = (episode.podcast?.name ?? "").toLowerCase();
    return title.includes(query) || podcastName.includes(query);
  });
});

const episodeKey = (episode: PodcastEpisode): string =>
  getEpisodeIdentity(episode);

const goBack = (): void => {
  router.push({ name: "podcasts" });
};

const toolbarMenuItems = computed<ToolBarMenuItem[]>(() => [
  {
    label: "refresh",
    icon: "mdi-refresh",
    action: () => refresh(),
    disabled: isLoading.value,
  },
]);

// Keep the open listing in sync with playback: progress icons and the
// unplayed-only filter must react to MEDIA_ITEM_PLAYED without a manual refresh.
let unsubscribePlayed: (() => void) | undefined;

onMounted(() => {
  load();
  unsubscribePlayed = api.subscribe(
    EventType.MEDIA_ITEM_PLAYED,
    (evt: EventMessage) => {
      applyPlaybackUpdate(evt.object_id, evt.data);
    },
  );
});

onBeforeUnmount(() => {
  unsubscribePlayed?.();
  unsubscribePlayed = undefined;
});
</script>
