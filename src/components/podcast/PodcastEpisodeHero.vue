<template>
  <DetailHero
    class="podcast-episode-hero"
    :class="{ 'podcast-episode-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    :height="400"
    :phone-height="360"
    :editable-rows="false"
  >
    <template v-if="item" #main>
      <div class="podcast-episode-hero__main">
        <div class="podcast-episode-hero__cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="podcast-episode-hero__text">
          <h1 class="podcast-episode-hero__name">{{ item.name }}</h1>

          <div class="podcast-episode-hero__meta">
            <div class="podcast-episode-hero__line">
              <PodcastIcon :size="16" class="podcast-episode-hero__icon" />
              <span class="podcast-episode-hero__line-text">
                <button
                  type="button"
                  class="podcast-episode-hero__link"
                  @click="gotoPodcast"
                >
                  {{ item.podcast.name }}
                </button>
              </span>
            </div>
            <div
              v-if="releaseDate || item.duration"
              class="podcast-episode-hero__line"
            >
              <Calendar :size="16" class="podcast-episode-hero__icon" />
              <span class="podcast-episode-hero__line-text">
                {{ releaseDate }}
                <template v-if="item.duration">
                  <span v-if="releaseDate" class="podcast-episode-hero__sep"
                    >·</span
                  >
                  {{ formatDuration(item.duration) }}
                </template>
              </span>
            </div>
          </div>

          <div class="podcast-episode-hero__actions">
            <DetailHeroPlayButton
              class="podcast-episode-hero__play"
              :item="item"
              :parent-item="parentPodcast"
            />
            <template v-if="showSteppers">
              <DetailHeroButton
                :icon="ChevronLeft"
                :label="$t('previous_episode')"
                icon-only
                :disabled="!hasPrevious"
                @click="emit('previous')"
              />
              <DetailHeroButton
                :icon="ChevronRight"
                :label="$t('next_episode')"
                icon-only
                :disabled="!hasNext"
                @click="emit('next')"
              />
            </template>
            <span
              v-if="item.fully_played"
              class="podcast-episode-hero__badge"
              :title="$t('item_fully_played')"
            >
              <Check :size="20" />
            </span>
            <span
              v-else-if="item.resume_position_ms"
              class="podcast-episode-hero__badge"
              :title="$t('item_in_progress')"
            >
              <ClockFading :size="20" />
            </span>
            <!-- holds the played state's place so the transcript button keeps
            its position while the episode is unplayed -->
            <span
              v-else
              class="podcast-episode-hero__badge podcast-episode-hero__badge--empty"
              aria-hidden="true"
            ></span>
            <DetailHeroButton
              v-if="showTranscript"
              :icon="Captions"
              :label="$t('transcript')"
              :icon-only="isPhone"
              @click="emit('transcript')"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-if="item" #aside>
      <!-- episodes carry no genres of their own, so they show the podcast's -->
      <DetailHeroGenres v-if="parentPodcast" :item="parentPodcast" />
      <div v-if="providers.length" class="podcast-episode-hero__chips">
        <span class="podcast-episode-hero__chip">
          <template
            v-for="(provider, index) in providers"
            :key="provider.domain"
          >
            <span v-if="index > 0" class="podcast-episode-hero__chip-sep"
              >·</span
            >
            <ProviderIcon :domain="provider.domain" :size="14" />
            {{ provider.name }}
          </template>
        </span>
      </div>
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { formatDuration } from "@/helpers/utils";
import { mappedServices } from "@/plugins/api/helpers";
import type { Podcast, PodcastEpisode } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import {
  Calendar,
  Captions,
  Check,
  ChevronLeft,
  ChevronRight,
  ClockFading,
  PodcastIcon,
} from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: PodcastEpisode;
  // the podcast the episode belongs to, which gives the play menu its options
  // for playing on from the episode and the hero its genres
  parentPodcast?: Podcast;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
  // shows the previous/next buttons, which hasPrevious and hasNext enable
  showSteppers?: boolean;
  hasPrevious?: boolean;
  hasNext?: boolean;
  showTranscript?: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "previous"): void;
  (e: "next"): void;
  (e: "transcript"): void;
}>();

const router = useRouter();

const isPhone = computed(() => isPhoneSizedScreen());

const coverSize = computed(() => (isPhone.value ? 132 : 200));

// empty when the episode has no (valid) publish date
const releaseDate = computed(() => {
  const value = props.item?.metadata?.release_date;
  const released = value ? new Date(value) : undefined;
  return released && !isNaN(released.getTime())
    ? released.toLocaleDateString(undefined, { dateStyle: "medium" })
    : "";
});

// one chip per music service, however many accounts of it hold the episode
const providers = computed(() =>
  props.item ? mappedServices(props.item) : [],
);

const gotoPodcast = function () {
  const podcast = props.item?.podcast;
  if (!podcast) return;
  router.push({
    name: "podcast",
    params: { itemId: podcast.item_id, provider: podcast.provider },
  });
};
</script>

<style scoped>
.podcast-episode-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.podcast-episode-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.podcast-episode-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.podcast-episode-hero__name {
  margin: 0;
  font-size: 44px;
  font-weight: 500;
  letter-spacing: -1.1px;
  line-height: 1.05;
  text-shadow: 0 2px 12px rgba(0, 0, 0, 0.5);
  display: -webkit-box;
  -webkit-line-clamp: 2;
  line-clamp: 2;
  -webkit-box-orient: vertical;
  overflow: hidden;
}

.podcast-episode-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.podcast-episode-hero__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.podcast-episode-hero__icon {
  flex: none;
}
.podcast-episode-hero__line-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* the podcast reads as a link in the line of text, so the button chrome goes */
.podcast-episode-hero__link {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  vertical-align: baseline;
  cursor: pointer;
}
.podcast-episode-hero__link:hover {
  text-decoration: underline;
}
.podcast-episode-hero__link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.podcast-episode-hero__sep {
  margin: 0 4px;
  opacity: 0.5;
}

.podcast-episode-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
/* the same chrome as the hero buttons, for the facts that are not actions */
.podcast-episode-hero__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
}
.podcast-episode-hero__badge--empty {
  visibility: hidden;
}
.podcast-episode-hero__chips {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.podcast-episode-hero__chip {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  height: 22px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}
.podcast-episode-hero__chip-sep {
  opacity: 0.4;
}

@media (max-width: 768px) {
  .podcast-episode-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .podcast-episode-hero__cover {
    width: 132px;
    height: 132px;
  }
  .podcast-episode-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
    line-height: 1.1;
  }
  .podcast-episode-hero__meta {
    font-size: 14px;
  }
  .podcast-episode-hero__actions {
    gap: 10px;
  }
  .podcast-episode-hero__actions .podcast-episode-hero__play {
    flex: 1;
  }
  .podcast-episode-hero__badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
  .podcast-episode-hero--phone .podcast-episode-hero__chips {
    justify-content: flex-start;
  }
}
</style>
