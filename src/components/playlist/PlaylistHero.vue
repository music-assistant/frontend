<template>
  <DetailHero
    class="playlist-hero"
    :class="{ 'playlist-hero--phone': isPhone }"
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    :height="400"
    :phone-height="360"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <!-- managing the playlist sits beside the favorite on the artwork, which
           keeps the actions row to playing it -->
      <Button
        v-if="canEditRules"
        type="button"
        variant="ghost-icon"
        size="icon-lg"
        class="mr-2 rounded-lg bg-black/35 hover:bg-black/45"
        :aria-label="$t('smart_playlist.edit_rules')"
        :title="$t('smart_playlist.edit_rules')"
        @click="emit('edit-rules')"
      >
        <Settings2 class="size-5" />
      </Button>
      <Button
        v-if="canShare"
        type="button"
        variant="ghost-icon"
        size="icon-lg"
        class="mr-2 rounded-lg bg-black/35 hover:bg-black/45"
        :aria-label="$t('share_playlist')"
        :title="$t('share_playlist')"
        @click="emit('share')"
      >
        <Share2 class="size-5" />
      </Button>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #main>
      <div class="playlist-hero__main">
        <div class="playlist-hero__cover">
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="playlist-hero__text">
          <h1 class="playlist-hero__name">{{ item.name }}</h1>

          <div class="playlist-hero__meta">
            <div
              v-if="isMusicAssistantPlaylist(item) || item.owner"
              class="playlist-hero__line"
            >
              <User :size="16" class="playlist-hero__icon" />
              <span class="playlist-hero__line-text">
                <PlaylistAccessSummary
                  v-if="isMusicAssistantPlaylist(item)"
                  :playlist="item"
                />
                <template v-else>{{ item.owner }}</template>
              </span>
            </div>
            <div class="playlist-hero__line">
              <ListMusic :size="16" class="playlist-hero__icon" />
              <span class="playlist-hero__line-text">
                <template v-for="(fact, index) in facts" :key="fact">
                  <span v-if="index > 0" class="playlist-hero__sep">·</span>
                  {{ fact }}
                </template>
              </span>
            </div>
          </div>

          <div class="playlist-hero__actions">
            <DetailHeroPlayButton
              class="playlist-hero__play"
              shrink-label
              :item="item"
            />
            <DetailHeroButton
              :icon="Shuffle"
              :label="$t('shuffle')"
              :disabled="!store.activePlayer"
              @click="api.playMedia(item, undefined, { shuffle: true })"
            />
            <DetailHeroButton
              v-if="radioRelevant(item)"
              :icon="Orbit"
              :label="$t('playlist_radio')"
              :disabled="!radioSupported(item)"
              @click="gotoRadio(item)"
            />
            <!-- the rules are readable by everyone, editing them is a toolbar action -->
            <DetailHeroButton
              v-if="hasRules"
              :icon="ListFilter"
              :label="$t('smart_playlist.rules_dialog_title')"
              @click="emit('show-rules')"
            />
            <span class="playlist-hero__badge" :title="providerBadgeTitle">
              <ProviderIcon :domain="providerDomain" :size="20" />
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
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import PlaylistAccessSummary from "@/components/PlaylistAccessSummary.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { isMusicAssistantPlaylist } from "@/helpers/playlist_access";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatDuration } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { getProviderIconDomain } from "@/plugins/api/helpers";
import type { Playlist } from "@/plugins/api/interfaces";
import { isPhoneSizedScreen } from "@/plugins/breakpoint";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import {
  ListFilter,
  ListMusic,
  Orbit,
  Settings2,
  Share2,
  Shuffle,
  User,
} from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Playlist;
  // the artwork painted behind the text, as an image url
  backdrop?: string;
  // whether that artwork is the cover standing in for missing wide art
  blurBackdrop?: boolean;
  // how many tracks the playlist holds, once the listing below has them
  trackCount?: number;
  // their total playing time in seconds, once they are known
  duration?: number;
  // a smart playlist whose rules could be loaded
  hasRules?: boolean;
  canEditRules?: boolean;
  canShare?: boolean;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
  (e: "show-rules"): void;
  (e: "edit-rules"): void;
  (e: "share"): void;
}>();

const isPhone = computed(() => isPhoneSizedScreen());

const coverSize = computed(() => (isPhone.value ? 132 : 200));

// "Playlist · 32 tracks · 2:01:15", without whatever is not known yet
const facts = computed(() => {
  const parts = [$t("playlist")];
  if (props.trackCount) {
    parts.push(
      $t("n_tracks", props.trackCount, { named: { count: props.trackCount } }),
    );
  }
  if (props.duration) parts.push(formatDuration(props.duration));
  return parts;
});

const providerDomain = computed(() =>
  props.item ? getProviderIconDomain(props.item) : "",
);

const providerBadgeTitle = computed(() => {
  const domain = providerDomain.value;
  if (domain === "library") return $t("in_library");
  return api.getProviderManifest(domain)?.name ?? domain;
});
</script>

<style scoped>
.playlist-hero__main {
  display: flex;
  align-items: flex-end;
  gap: 24px;
  width: 100%;
  min-width: 0;
}
.playlist-hero__cover {
  width: 200px;
  height: 200px;
  flex: none;
  border-radius: 8px;
  overflow: hidden;
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.5);
}
.playlist-hero__text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 10px;
  min-width: 0;
  padding-bottom: 4px;
}

.playlist-hero__name {
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

.playlist-hero__meta {
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 15px;
  color: rgba(255, 255, 255, 0.85);
  text-shadow: 0 1px 6px rgba(0, 0, 0, 0.5);
}
.playlist-hero__line {
  display: flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}
.playlist-hero__icon {
  flex: none;
}
.playlist-hero__line-text {
  min-width: 0;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.playlist-hero__sep {
  margin: 0 4px;
  opacity: 0.5;
}

.playlist-hero__actions {
  display: flex;
  align-items: center;
  flex-wrap: nowrap;
  gap: 8px;
  min-width: 0;
}
/* the play button gives way so the other buttons keep their place on the row */
.playlist-hero__play {
  min-width: 0;
}
/* the same chrome as the hero buttons, for the facts that are not actions */
.playlist-hero__badge {
  display: inline-flex;
  flex: none;
  align-items: center;
  justify-content: center;
  width: 36px;
  height: 36px;
  border: 1px solid rgba(255, 255, 255, 0.25);
  border-radius: 8px;
  background: rgba(0, 0, 0, 0.4);
}

@media (max-width: 768px) {
  .playlist-hero__main {
    flex-direction: column;
    align-items: stretch;
    gap: 12px;
  }
  .playlist-hero__cover {
    width: 132px;
    height: 132px;
  }
  .playlist-hero__name {
    font-size: 30px;
    letter-spacing: -0.7px;
    line-height: 1.1;
  }
  .playlist-hero__meta {
    font-size: 14px;
  }
  /* a phone has no room for every button beside play, so the row wraps */
  .playlist-hero__actions {
    flex-wrap: wrap;
    gap: 10px;
  }
  .playlist-hero__actions .playlist-hero__play {
    flex: 1;
  }
  .playlist-hero__badge {
    width: 44px;
    height: 44px;
    border-radius: 10px;
  }
}
</style>
