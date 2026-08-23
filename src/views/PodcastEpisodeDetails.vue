<template>
  <InfoHeader :item="itemDetails">
    <template v-if="siblings.length > 1" #title-prepend>
      <ChevronLeft
        :size="26"
        :class="previousEpisode ? 'cursor-pointer' : 'opacity-30'"
        :title="$t('previous_episode')"
        @click="openEpisode(previousEpisode)"
      />
    </template>
    <template v-if="siblings.length > 1" #title-append>
      <ChevronRight
        :size="26"
        :class="nextEpisode ? 'cursor-pointer' : 'opacity-30'"
        :title="$t('next_episode')"
        @click="openEpisode(nextEpisode)"
      />
    </template>
    <template #append-actions>
      <!-- fixed width so the icons beside it keep their place while unplayed -->
      <div class="played-state">
        <v-icon
          v-if="itemDetails?.fully_played"
          icon="mdi-check"
          :title="$t('item_fully_played')"
        />
        <v-icon
          v-else-if="itemDetails?.resume_position_ms"
          icon="mdi-clock-fast"
          :title="$t('item_in_progress')"
        />
      </div>
      <Captions
        v-if="showTranscriptButton"
        :size="33"
        class="cursor-pointer"
        :title="$t('transcript_show')"
        @click="openTranscript"
      />
    </template>
  </InfoHeader>

  <!-- keyed per episode: a listing already loading drops a reload request, so
  clicking through episodes quickly would leave the previous episode's list -->
  <ItemsListing
    v-if="itemDetails"
    :key="`${props.provider}.${props.itemId}`"
    itemtype="podcastepisodes"
    :show-provider="false"
    :show-favorites-only-filter="false"
    :show-hide-fully-played-filter="true"
    :show-track-number="true"
    :show-refresh-button="false"
    :load-items="loadOtherEpisodes"
    :sort-keys="[
      'position',
      'position_desc',
      'name',
      'duration',
      'duration_desc',
    ]"
    :title="$t('other_episodes')"
    :hide-on-empty="true"
    :allow-collapse="true"
    :path="`episode.${props.itemId}.${props.provider}`"
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
</template>

<script setup lang="ts">
import InfoHeader from "@/components/InfoHeader.vue";
import ItemsListing, { LoadDataParams } from "@/components/ItemsListing.vue";
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
import type { PodcastEpisode } from "@/plugins/api/interfaces";
import { Captions, ChevronLeft, ChevronRight } from "@lucide/vue";
import { computed, ref, watch } from "vue";
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

// the listing orders episodes by position, so the steppers follow that same
// order: a feed whose episodes carry mixed position numbers would otherwise
// send the steppers somewhere other than the next row on screen
const orderedSiblings = computed(() =>
  [...siblings.value].sort((a, b) => (a.position || 0) - (b.position || 0)),
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
  try {
    // the server renders the cues as readable text, so this arrives without timestamps
    const [text] = await api.getPodcastEpisodeTranscript(
      props.itemId,
      props.provider,
    );
    transcript.value = text;
    transcriptLoaded.value = true;
  } catch (error) {
    console.error("Failed to fetch podcast transcript:", error);
  } finally {
    transcriptLoading.value = false;
  }
};

watch(
  () => [props.itemId, props.provider],
  async ([itemId, provider]) => {
    if (!itemId) return;
    transcript.value = null;
    transcriptLoaded.value = false;
    const details = (detailsRequest = api.getPodcastEpisode(itemId, provider));
    const episodes = (episodesRequest = details.then((episode) =>
      api.getPodcastEpisodes(episode.podcast.item_id, episode.podcast.provider),
    ));
    const episode = await details;
    // a quick click through the steppers can move on while these are in flight
    if (details !== detailsRequest) return;
    itemDetails.value = episode;
    const siblingEpisodes = await episodes;
    if (episodes !== episodesRequest) return;
    siblings.value = siblingEpisodes;
  },
  { immediate: true },
);
</script>

<style scoped>
.played-state {
  display: flex;
  justify-content: center;
  width: 26px;
}

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
