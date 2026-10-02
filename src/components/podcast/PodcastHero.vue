<template>
  <DetailHero
    class="podcast-hero"
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    :height="400"
    :phone-height="360"
    :editable-rows="false"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #main>
      <div class="podcast-hero__main">
        <div class="podcast-hero__cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="podcast-hero__text">
          <h1 class="podcast-hero__name">{{ item.name }}</h1>

          <div class="podcast-hero__meta">
            <div v-if="item.publisher" class="podcast-hero__line">
              <Mic :size="16" class="podcast-hero__icon" />
              <span class="podcast-hero__line-text">{{ item.publisher }}</span>
            </div>
            <div v-if="episodeCount != null" class="podcast-hero__line">
              <PodcastIcon :size="16" class="podcast-hero__icon" />
              <span class="podcast-hero__line-text">
                {{
                  $t("n_episodes", episodeCount, {
                    named: { count: episodeCount },
                  })
                }}
              </span>
            </div>
          </div>

          <div class="podcast-hero__actions">
            <DetailHeroPlayButton :item="item" />
            <!-- outside the library the services listed beside already say where it is from -->
            <span
              v-if="isItemInLibrary(item)"
              class="podcast-hero__badge"
              role="img"
              :title="$t('in_library')"
              :aria-label="$t('in_library')"
            >
              <ProviderIcon domain="library" :size="20" />
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { isItemInLibrary } from "@/plugins/api/helpers";
import type { Podcast } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { Mic, PodcastIcon } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Podcast;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
  // how many episodes the podcast holds, once known
  episodeCount?: number;
}
defineProps<Props>();

const coverSize = computed(() => (isPhoneSizedScreen() ? 132 : 200));
</script>

<style scoped>
.podcast-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.podcast-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.podcast-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.podcast-hero__name {
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

.podcast-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.podcast-hero__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.podcast-hero__icon {
  flex: none;
}
.podcast-hero__line-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.podcast-hero__actions {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
/* the same chrome as the hero buttons, for the facts that are not actions */
.podcast-hero__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
}

@media (max-width: 768px) {
  .podcast-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .podcast-hero__cover {
    width: 132px;
    height: 132px;
  }
  .podcast-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
    line-height: 1.1;
  }
  .podcast-hero__meta {
    font-size: 14px;
  }
  .podcast-hero__actions {
    gap: 10px;
  }
  .podcast-hero__badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
}
</style>
