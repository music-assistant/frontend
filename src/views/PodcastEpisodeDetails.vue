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

    <!-- keyed per episode: a listing already loading drops a reload request, so
    clicking through episodes quickly would leave the previous episode's list -->
    <ItemsListing
      v-if="itemDetails"
      :key="episodeKey"
      itemtype="podcastepisodes"
      :parent-item="parentPodcast"
      :refresh-on-parent-update="true"
      :show-provider="false"
      :show-favorites-only-filter="false"
      :show-hide-fully-played-filter="true"
      :show-track-number="true"
      :show-refresh-button="false"
      :load-items="loadOtherEpisodes"
      :sort-keys="[
        'position_desc',
        'position',
        'name',
        'duration',
        'duration_desc',
      ]"
      :title="$t('other_episodes')"
      :hide-on-empty="true"
      :allow-collapse="true"
      :path="`podcast_episodes.${podcastKey}`"
    />

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
import DetailTextRow from "@/components/details/DetailTextRow.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
import {
  podcastEpisodeBackdrop,
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
import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  itemId: string;
  provider: string;
}
const props = defineProps<Props>();

const router = useRouter();

const episodeKey = computed(() => `${props.provider}.${props.itemId}`);

const itemDetails = ref<PodcastEpisode>();
// all episodes of the podcast, in its own order, for the steppers
const siblings = ref<PodcastEpisode[]>([]);
// the podcast itself, which the listing rows need for their play actions
const parentPodcast = ref<Podcast>();
const showTranscript = ref(false);
const transcript = ref<string | null>(null);
const transcriptLoaded = ref(false);
const transcriptLoading = ref(false);

// the episodes listing reloads as soon as the route changes, a moment before
// the new details arrive; sharing the requests keeps the two on one episode
let detailsRequest: Promise<PodcastEpisode> | undefined;
let episodesRequest: Promise<PodcastEpisode[]> | undefined;

// A provider that cannot tell reports null, in which case the transcript is
// worth offering: the episode itself is the only place left to find out.
const showTranscriptButton = computed(
  () => itemDetails.value?.metadata.has_transcript !== false,
);

// the sort and view choices belong to the podcast, so every episode of it opens
// the listing the same way instead of storing a preference per episode
const podcastKey = computed(() => {
  const podcast = itemDetails.value?.podcast;
  return podcast ? `${podcast.item_id}.${podcast.provider}` : "";
});

// the listing opens newest first, so the steppers follow that same order and the
// right arrow always lands on the row below. changing the sort in the listing
// moves it away from the steppers, which stay on the podcast's own order
const orderedSiblings = computed(() =>
  [...siblings.value].sort((a, b) => (b.position || 0) - (a.position || 0)),
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

const loadOtherEpisodes = async function (_params: LoadDataParams) {
  const [episode, episodes] = await Promise.all([
    detailsRequest,
    episodesRequest,
  ]);
  if (!episode || !episodes) return [];
  return episodes.filter((other) => other.item_id !== episode.item_id);
};

const openTranscript = async function () {
  showTranscript.value = true;
  if (transcriptLoaded.value || transcriptLoading.value) return;
  transcriptLoading.value = true;
  const requested = episodeKey.value;
  try {
    // the server renders the cues as readable text, so this arrives without timestamps
    const [text] = await api.getPodcastEpisodeTranscript(
      props.itemId,
      props.provider,
    );
    // stepping to another episode while this was in flight leaves it for that one
    if (requested !== episodeKey.value) return;
    transcript.value = text;
    transcriptLoaded.value = true;
  } catch (error) {
    console.error("Failed to fetch podcast transcript:", error);
  } finally {
    if (requested === episodeKey.value) transcriptLoading.value = false;
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
    const episodes = (episodesRequest = details
      .then((episode) =>
        api.getPodcastEpisodes(
          episode.podcast.item_id,
          episode.podcast.provider,
        ),
      )
      // an episode listing we cannot fetch leaves the steppers and the listing
      // empty rather than failing the page
      .catch(() => []));
    const episode = await details;
    // a quick click through the steppers can move on while these are in flight
    if (details !== detailsRequest) return;
    itemDetails.value = episode;
    const siblingEpisodes = await episodes;
    if (episodes !== episodesRequest) return;
    siblings.value = siblingEpisodes;
    if (parentPodcast.value && isPodcastOf(parentPodcast.value, episode))
      return;
    // only fetched when the podcast itself changes, so stepping through the
    // episodes of one podcast does not keep asking for it
    const podcast = await api
      .getPodcast(episode.podcast.item_id, episode.podcast.provider)
      .catch(() => undefined);
    if (details !== detailsRequest) return;
    parentPodcast.value = podcast;
  },
  { immediate: true },
);

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
