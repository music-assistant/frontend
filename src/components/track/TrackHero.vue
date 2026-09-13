<template>
  <DetailHero
    class="track-hero"
    :class="{ 'track-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :height="400"
    :phone-height="360"
    @edit-rows="emit('edit-rows')"
  >
    <template v-if="item" #main>
      <div class="track-hero__main">
        <div class="track-hero__cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="track-hero__text">
          <h1 class="track-hero__name">
            {{ item.name }}
            <span v-if="item.version" class="track-hero__version">
              ({{ item.version }})
            </span>
            <span
              v-if="item.metadata?.explicit"
              class="track-hero__explicit"
              role="img"
              :title="$t('tooltip.explicit')"
              :aria-label="$t('tooltip.explicit')"
              >E</span
            >
          </h1>

          <div class="track-hero__meta">
            <div v-if="item.artists.length" class="track-hero__line">
              <Music :size="16" class="track-hero__icon" />
              <span class="track-hero__line-text">
                <template
                  v-for="(artist, index) in item.artists"
                  :key="artist.uri"
                >
                  <span v-if="index > 0">,&nbsp;</span>
                  <button
                    type="button"
                    class="track-hero__link"
                    @click="gotoItem('artist', artist)"
                  >
                    {{ artist.name }}
                  </button>
                </template>
              </span>
            </div>
            <div
              v-if="item.album || releaseYear || item.duration"
              class="track-hero__line"
            >
              <Disc :size="16" class="track-hero__icon" />
              <span class="track-hero__line-text">
                <button
                  v-if="item.album"
                  type="button"
                  class="track-hero__link"
                  @click="gotoItem('album', item.album)"
                >
                  {{ item.album.name }}
                </button>
                <template v-if="releaseYear">
                  <span v-if="item.album" class="track-hero__sep">·</span>
                  {{ releaseYear }}
                </template>
                <template v-if="item.duration">
                  <span v-if="item.album || releaseYear" class="track-hero__sep"
                    >·</span
                  >
                  {{ formatDuration(item.duration) }}
                </template>
              </span>
            </div>
          </div>

          <div class="track-hero__actions">
            <DetailHeroPlayButton class="track-hero__play" :item="item" />
            <DetailHeroButton
              v-if="radioRelevant(item)"
              :icon="Radio"
              :label="$t('track_radio')"
              :icon-only="isPhone"
              :disabled="!radioSupported(item)"
              @click="gotoRadio(item)"
            />
            <DetailHeroButton
              v-if="canEditLibrary"
              :icon="item.favorite ? IconHeartFilled : IconHeart"
              :label="favoriteButtonLabel"
              icon-only
              :pressed="item.favorite"
              @click="api.toggleFavorite(item)"
            />
            <span class="track-hero__badge" :title="providerBadgeTitle">
              <ProviderIcon :domain="providerDomain" :size="20" />
            </span>
            <span
              v-if="
                item.audio_metadata?.bpm || item.audio_metadata?.musical_key
              "
              class="track-hero__badge"
            >
              <AudioAnalysisMetadata :audio-metadata="item.audio_metadata" />
            </span>
            <span v-if="qualityLabel" class="track-hero__pill">
              {{ qualityLabel }}
            </span>
          </div>
        </div>
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import AudioAnalysisMetadata from "@/components/AudioAnalysisMetadata.vue";
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import {
  audioFormatLabel,
  bestAudioFormat,
  trackReleaseYear,
} from "@/components/track/trackData";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { getProviderIconDomain } from "@/plugins/api/helpers";
import { Scope, type Track } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { Disc, Music, Radio } from "@lucide/vue";
import { IconHeart, IconHeartFilled } from "@tabler/icons-vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: Track;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();

const isPhone = computed(() => isPhoneSizedScreen());

const coverSize = computed(() => (isPhone.value ? 132 : 200));

const releaseYear = computed(() => props.item && trackReleaseYear(props.item));

const favoriteButtonLabel = computed(() =>
  props.item?.favorite ? $t("favorites_remove") : $t("favorites_add"),
);
// favouring an item changes the library
const canEditLibrary = computed(() =>
  authManager.hasScope(Scope.LIBRARY_WRITE),
);

const providerDomain = computed(() =>
  props.item ? getProviderIconDomain(props.item) : "",
);

const providerBadgeTitle = computed(() => {
  const domain = providerDomain.value;
  if (domain === "library") return $t("in_library");
  return api.getProviderManifest(domain)?.name ?? domain;
});

const qualityLabel = computed(() => {
  const format = props.item && bestAudioFormat(props.item);
  return format ? audioFormatLabel(format) : undefined;
});

const gotoItem = function (
  name: "artist" | "album",
  target: { item_id: string; provider: string },
) {
  router.push({
    name,
    params: { itemId: target.item_id, provider: target.provider },
  });
};
</script>

<style scoped>
.track-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.track-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.track-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.track-hero__name {
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
.track-hero__version {
  font-size: 0.6em;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.7);
}
.track-hero__explicit {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  margin-left: 6px;
  border-radius: 3px;
  background: rgba(255, 255, 255, 0.25);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0;
  line-height: 1;
  text-shadow: none;
  vertical-align: middle;
}

.track-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.track-hero__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.track-hero__icon {
  flex: none;
}
.track-hero__line-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* the artist and album read as links in the line of text, so the button chrome goes */
.track-hero__link {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  vertical-align: baseline;
  cursor: pointer;
}
.track-hero__link:hover {
  text-decoration: underline;
}
.track-hero__link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.track-hero__sep {
  margin: 0 4px;
  opacity: 0.5;
}

.track-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}
/* the same chrome as the hero buttons, for the facts that are not actions */
.track-hero__badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
}
.track-hero__pill {
  display: inline-flex;
  align-items: center;
  height: 22px;
  margin-left: 4px;
  padding: 0 8px;
  border-radius: 999px;
  background: rgba(0, 0, 0, 0.45);
  font-size: 12px;
  font-weight: 500;
  white-space: nowrap;
}

@media (max-width: 768px) {
  .track-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .track-hero__cover {
    width: 132px;
    height: 132px;
  }
  .track-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
    line-height: 1.1;
  }
  .track-hero__meta {
    font-size: 14px;
  }
  .track-hero__actions {
    gap: 10px;
  }
  .track-hero__actions .track-hero__play {
    flex: 1;
  }
  .track-hero__badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
}
</style>
