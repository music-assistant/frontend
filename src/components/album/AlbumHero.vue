<template>
  <DetailHero
    class="album-hero"
    :class="{ 'album-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    :height="400"
    :phone-height="360"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #main>
      <div class="album-hero__main">
        <div class="album-hero__cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="album-hero__text">
          <h1 class="album-hero__name">
            {{ item.name }}
            <span v-if="item.version" class="album-hero__version">
              ({{ item.version }})
            </span>
            <span
              v-if="item.metadata?.explicit"
              class="album-hero__explicit"
              role="img"
              :title="$t('tooltip.explicit')"
              :aria-label="$t('tooltip.explicit')"
              >E</span
            >
          </h1>

          <div class="album-hero__meta">
            <div v-if="item.artists.length" class="album-hero__line">
              <Music :size="16" class="album-hero__icon" />
              <span class="album-hero__line-text">
                <template
                  v-for="(artist, index) in item.artists"
                  :key="artist.uri"
                >
                  <span v-if="index > 0">,&nbsp;</span>
                  <button
                    type="button"
                    class="album-hero__link"
                    @click="gotoArtist(artist)"
                  >
                    {{ artist.name }}
                  </button>
                </template>
              </span>
            </div>
            <div v-if="facts.length" class="album-hero__line">
              <Disc :size="16" class="album-hero__icon" />
              <span class="album-hero__line-text">
                <template v-for="(fact, index) in facts" :key="fact">
                  <span v-if="index > 0" class="album-hero__sep">·</span>
                  {{ fact }}
                </template>
              </span>
            </div>
          </div>

          <div class="album-hero__actions">
            <DetailHeroPlayButton class="album-hero__play" :item="item" />
            <DetailHeroButton
              v-if="api.supportsPlayMediaShuffle"
              :icon="Shuffle"
              :label="$t('shuffle')"
              :icon-only="isPhone"
              :disabled="!store.activePlayer"
              @click="api.playMedia(item, undefined, { shuffle: true })"
            />
            <DetailHeroButton
              v-if="radioRelevant(item)"
              :icon="Orbit"
              :label="$t('album_radio')"
              :icon-only="isPhone"
              :disabled="!radioSupported(item)"
              @click="gotoRadio(item)"
            />
          </div>
        </div>
      </div>
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <div v-if="providers.length" class="album-hero__chips">
        <span class="album-hero__chip">
          <template
            v-for="(provider, index) in providers"
            :key="provider.domain"
          >
            <span v-if="index > 0" class="album-hero__chip-sep">·</span>
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
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { mappedServices } from "@/plugins/api/helpers";
import {
  AlbumType,
  type Album,
  type Artist,
  type ItemMapping,
} from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Disc, Music, Orbit, Shuffle } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  item?: Album;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
  // how many tracks the album holds, once the listing below has them
  trackCount?: number;
  // their total playing time in seconds, once they are known
  duration?: number;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();

const isPhone = computed(() => isPhoneSizedScreen());

const coverSize = computed(() => (isPhone.value ? 132 : 200));

// one chip per music service, however many accounts of it hold the album
const providers = computed(() =>
  props.item ? mappedServices(props.item) : [],
);

// "Album · 2011 · 12 tracks · 48:21", without whatever the album does not have
const facts = computed(() => {
  const album = props.item;
  if (!album) return [];
  const parts: string[] = [];
  if (album.album_type !== AlbumType.UNKNOWN) {
    parts.push($t(`album_type.${album.album_type}`));
  }
  if (album.year) parts.push(String(album.year));
  if (props.trackCount) {
    parts.push(
      $t("n_tracks", props.trackCount, { named: { count: props.trackCount } }),
    );
  }
  if (props.duration) parts.push(formatDuration(props.duration));
  return parts;
});

const gotoArtist = function (artist: Artist | ItemMapping) {
  router.push({
    name: "artist",
    params: { itemId: artist.item_id, provider: artist.provider },
  });
};
</script>

<style scoped>
.album-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.album-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.album-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.album-hero__name {
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
.album-hero__version {
  font-size: 0.6em;
  letter-spacing: 0;
  color: rgba(255, 255, 255, 0.7);
}
.album-hero__explicit {
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

.album-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.album-hero__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.album-hero__icon {
  flex: none;
}
.album-hero__line-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
/* the artists read as links in the line of text, so the button chrome goes */
.album-hero__link {
  display: inline;
  padding: 0;
  border: 0;
  background: none;
  color: inherit;
  font: inherit;
  vertical-align: baseline;
  cursor: pointer;
}
.album-hero__link:hover {
  text-decoration: underline;
}
.album-hero__link:focus-visible {
  outline: 2px solid rgb(var(--v-theme-primary));
  outline-offset: 2px;
  border-radius: 4px;
}
.album-hero__sep {
  margin: 0 4px;
  opacity: 0.5;
}

.album-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
}

.album-hero__chips {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  flex-wrap: wrap;
  gap: 8px;
}
.album-hero__chip {
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
.album-hero__chip-sep {
  opacity: 0.4;
}

@media (max-width: 768px) {
  .album-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .album-hero__cover {
    width: 132px;
    height: 132px;
  }
  .album-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
    line-height: 1.1;
  }
  .album-hero__meta {
    font-size: 14px;
  }
  .album-hero__actions {
    gap: 10px;
  }
  .album-hero__actions .album-hero__play {
    flex: 1;
  }
  .album-hero--phone .album-hero__chips {
    justify-content: flex-start;
  }
}
</style>
