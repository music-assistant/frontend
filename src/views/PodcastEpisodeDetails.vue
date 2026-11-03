<template>
  <section class="podcast-episode-details">
    <PodcastEpisodeHero
      :item="itemDetails"
      :parent-podcast="episodePodcast"
      :backdrop="backdrop.url"
      :blur-backdrop="backdrop.blurred"
      :show-steppers="siblings.length > 1"
      :has-previous="!!previousEpisode"
      :has-next="!!nextEpisode"
      :show-transcript="showTranscriptButton"
      @previous="openEpisode(previousEpisode)"
      @next="openEpisode(nextEpisode)"
      @transcript="openTranscript"
    />

    <DetailTextRow
      v-if="itemDetails?.metadata.description"
      :title="$t('about_episode')"
      :text="itemDetails.metadata.description"
      :dialog-title="itemDetails.name"
      markdown
      :lines="4"
    />

    <!-- episode chapters, with the user's bookmarks inside them -->
    <Chapters v-if="itemDetails" :item-details="itemDetails" />

    <!-- a few to go on with; the podcast page lists them all -->
    <MediaRowList
      v-if="itemDetails && otherEpisodeItems.length"
      :title="$t('other_episodes')"
      :items="otherEpisodeItems"
      :limit="OTHER_EPISODES_LIMIT"
      :view-all-to="podcastRoute"
      :parent-item="episodePodcast"
    >
      <template #subtitle="{ item }">{{ episodeSubtitle(item) }}</template>
    </MediaRowList>

    <Dialog v-model:open="showTranscript">
      <DialogContent class="sm:max-w-[640px]">
        <DialogHeader>
          <DialogTitle>{{ $t("transcript") }}</DialogTitle>
          <DialogDescription>{{ itemDetails?.name }}</DialogDescription>
        </DialogHeader>
        <div class="transcript-body">
          <div v-if="transcriptLoading" class="transcript-status">
            <Spinner class="size-6" />
            <div>{{ $t("transcript_loading") }}</div>
          </div>
          <div v-else-if="!transcript" class="transcript-status">
            {{ $t("transcript_unavailable") }}
          </div>
          <div v-else class="transcript-text">{{ transcript }}</div>
        </div>
        <DialogFooter>
          <Button @click="showTranscript = false">{{ $t("close") }}</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  </section>
</template>

<script setup lang="ts">
import Chapters from "@/components/Chapters.vue";
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import MediaRowList, {
  type RowItem,
} from "@/components/details/MediaRowList.vue";
import {
  episodeReleaseDate,
  otherEpisodes,
  podcastEpisodeBackdrop,
  podcastEpisodeNumber,
  type PodcastEpisodeBackdrop,
} from "@/components/podcast/podcastEpisodeData";
import PodcastEpisodeHero from "@/components/podcast/PodcastEpisodeHero.vue";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { api } from "@/plugins/api";
import {
  EventType,
  type EventMessage,
  type PlaylogUpdate,
  type Podcast,
  type PodcastEpisode,
} from "@/plugins/api/interfaces";
import { store } from "@/plugins/store";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const router = useRouter();

const itemDetails = ref<PodcastEpisode>();
// all episodes of the podcast, in its own order, for the steppers
const siblings = ref<PodcastEpisode[]>([]);
// the podcast itself, which the episode rows need for their play actions
const parentPodcast = ref<Podcast>();
const showTranscript = ref(false);
const transcript = ref<string | null>(null);
const transcriptLoaded = ref(false);
const transcriptLoading = ref(false);

// the latest details request, so answers for an episode stepped away from are dropped
let detailsRequest: Promise<PodcastEpisode> | undefined;

// A provider that cannot tell reports null, in which case the transcript is
// worth offering: the episode itself is the only place left to find out.
const showTranscriptButton = computed(
  () => itemDetails.value?.metadata.has_transcript !== false,
);

// newest first, as the podcast page lists them, so the right arrow and the
// first of the other episodes both lead to the one below this
const orderedSiblings = computed(() =>
  [...siblings.value].sort((a, b) => b.position - a.position),
);

const currentIndex = computed(() =>
  orderedSiblings.value.findIndex(
    (episode) => episode.item_id === itemDetails.value?.item_id,
  ),
);

const previousEpisode = computed(() =>
  currentIndex.value > 0
    ? orderedSiblings.value[currentIndex.value - 1]
    : undefined,
);

const nextEpisode = computed(() =>
  currentIndex.value >= 0
    ? orderedSiblings.value[currentIndex.value + 1]
    : undefined,
);

// the loaded podcast, only while it is the one the shown episode belongs to
const episodePodcast = computed(() => {
  const episode = itemDetails.value;
  const podcast = parentPodcast.value;
  return episode && podcast && isPodcastOf(podcast, episode)
    ? podcast
    : undefined;
});

// the podcast's own artwork once it is loaded for this episode, else what the
// episode carries of it
const backdrop = computed<PodcastEpisodeBackdrop>(() => {
  const episode = itemDetails.value;
  if (!episode) return { blurred: false };
  return podcastEpisodeBackdrop(
    episode,
    episodePodcast.value ?? episode.podcast,
  );
});

const openEpisode = function (episode?: PodcastEpisode) {
  if (!episode) return;
  router.push({
    name: "podcast_episode",
    params: { itemId: episode.item_id, provider: episode.provider },
  });
};

const OTHER_EPISODES_LIMIT = 5;

const otherEpisodeItems = computed(() =>
  itemDetails.value
    ? otherEpisodes(orderedSiblings.value, itemDetails.value)
    : [],
);

// "View all" opens the podcast with its full episode listing
const podcastRoute = computed(() => {
  const podcast = episodePodcast.value ?? itemDetails.value?.podcast;
  return podcast
    ? {
        name: "podcast",
        params: { itemId: podcast.item_id, provider: podcast.provider },
      }
    : undefined;
});

// e.g. "S1 E53 · 22 Oct 2026"
const episodeSubtitle = function (item: RowItem): string {
  if (!("podcast" in item)) return "";
  return [podcastEpisodeNumber(item)?.short, episodeReleaseDate(item)]
    .filter(Boolean)
    .join(" · ");
};

const openTranscript = async function () {
  showTranscript.value = true;
  if (transcriptLoaded.value || transcriptLoading.value) return;
  transcriptLoading.value = true;
  const requested = detailsRequest;
  try {
    // the server renders the cues as readable text, so this arrives without timestamps
    const [text] = await api.getPodcastEpisodeTranscript(
      props.itemId,
      props.provider,
    );
    // stepping away while this was in flight leaves it for that route load
    if (requested !== detailsRequest) return;
    transcript.value = text;
    transcriptLoaded.value = true;
  } catch (error) {
    console.error("Failed to fetch podcast transcript:", error);
  } finally {
    if (requested === detailsRequest) transcriptLoading.value = false;
  }
};

watch(
  () => [props.itemId, props.provider],
  async ([itemId, provider]) => {
    if (!itemId) return;
    transcript.value = null;
    transcriptLoaded.value = false;
    transcriptLoading.value = false;
    showTranscript.value = false;
    const details = (detailsRequest = api.getPodcastEpisode(itemId, provider));
    const episodes = details
      .then((episode) =>
        api.getPodcastEpisodes(
          episode.podcast.item_id,
          episode.podcast.provider,
          undefined,
          undefined,
          0,
        ),
      )
      // an episode listing we cannot fetch leaves the steppers empty rather
      // than failing the page
      .catch(() => []);
    const episode = await details.catch((error) => {
      console.error("Failed to fetch podcast episode:", error);
      return undefined;
    });
    // a quick click through the steppers can move on while these are in flight
    if (details !== detailsRequest) return;
    // an episode that failed to load must not leave the previous one shown
    itemDetails.value = episode;
    if (!episode) return;
    // only fetched when the podcast itself changes, so stepping through the
    // episodes of one podcast does not keep asking for it
    const podcastRequest =
      parentPodcast.value && isPodcastOf(parentPodcast.value, episode)
        ? Promise.resolve(parentPodcast.value)
        : api
            .getPodcast(episode.podcast.item_id, episode.podcast.provider)
            .catch(() => undefined);
    const [siblingEpisodes, podcast] = await Promise.all([
      episodes,
      podcastRequest,
    ]);
    if (details !== detailsRequest) return;
    siblings.value = siblingEpisodes;
    parentPodcast.value = podcast;
  },
  { immediate: true },
);

onMounted(() => {
  // marking the episode (un)played or playing it to the end changes its played
  // state; a new object lets the hero rebuild its menu for that state
  const unsub = api.subscribe(
    EventType.PLAYLOG_UPDATED,
    (evt: EventMessage) => {
      const update = evt.data as PlaylogUpdate | undefined;
      const episode = itemDetails.value;
      if (!update || !episode || update.uri !== episode.uri) return;
      // per-user playlog: ignore changes belonging to another user (null = everyone)
      if (update.userid && update.userid !== store.currentUser?.user_id) return;
      itemDetails.value = {
        ...episode,
        fully_played: update.fully_played,
        resume_position_ms: update.seconds_played * 1000,
      };
    },
  );
  onBeforeUnmount(unsub);
});

// stepping to another episode navigates in place, so it starts at the top
watch(
  () => itemDetails.value?.uri,
  () => document.querySelector(".content-section")?.scrollTo({ top: 0 }),
);

/**
 * Whether the podcast is the one the episode belongs to, also when it is the
 * library copy of the provider podcast the episode points at.
 */
function isPodcastOf(podcast: Podcast, episode: PodcastEpisode): boolean {
  const { item_id, provider } = episode.podcast;
  return (
    podcast.uri === episode.podcast.uri ||
    podcast.provider_mappings.some(
      (mapping) =>
        mapping.item_id === item_id &&
        [mapping.provider_instance, mapping.provider_domain].includes(provider),
    )
  );
}
</script>

<style scoped>
.transcript-body {
  max-height: 60vh;
  overflow-y: auto;
}

.transcript-status {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  padding: 24px 0;
  opacity: 0.7;
}

.transcript-text {
  white-space: pre-wrap;
  overflow-wrap: break-word;
  font-size: 0.875rem;
  line-height: 1.625;
}
</style>
