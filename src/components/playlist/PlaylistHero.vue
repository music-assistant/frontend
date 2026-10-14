<template>
  <DetailHero
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
      <div
        class="flex w-full min-w-0 items-end gap-6 max-md:flex-col max-md:items-stretch max-md:gap-3"
      >
        <div
          class="size-[200px] flex-none overflow-hidden rounded-lg shadow-[0_8px_24px_rgba(0,0,0,0.5)] max-md:size-[132px]"
        >
          <MediaItemThumb :item="item" :size="coverSize" :rounded="false" />
        </div>

        <div class="flex min-w-0 flex-1 flex-col gap-2.5 pb-1">
          <h1
            class="m-0 line-clamp-2 text-[44px] leading-[1.2] font-medium tracking-[-1.1px] [text-shadow:0_2px_12px_rgba(0,0,0,0.5)] max-md:text-[30px] max-md:tracking-[-0.7px]"
          >
            {{ item.name }}
          </h1>

          <div
            class="flex flex-col gap-1 text-[15px] text-white/85 [text-shadow:0_1px_6px_rgba(0,0,0,0.5)] max-md:text-sm"
          >
            <div
              v-if="isMusicAssistantPlaylist(item) || item.owner"
              class="flex min-w-0 items-center gap-2"
            >
              <User :size="16" class="flex-none" />
              <span class="min-w-0 truncate">
                <PlaylistAccessSummary
                  v-if="isMusicAssistantPlaylist(item)"
                  :playlist="item"
                />
                <template v-else>{{ item.owner }}</template>
              </span>
            </div>
            <DetailHeroFacts :icon="ListMusic" :facts="facts" />
          </div>

          <!-- a phone has no room for every button beside play, so the row wraps there -->
          <div
            class="flex min-w-0 flex-nowrap items-center gap-2 max-md:flex-wrap max-md:gap-2.5"
          >
            <DetailHeroPlayButton
              class="min-w-0 max-md:flex-1"
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
            <span
              v-if="!isPhone"
              class="inline-flex size-9 flex-none items-center justify-center rounded-lg border border-white/25 bg-black/40"
              :title="providerBadgeTitle"
            >
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
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import MediaItemThumb from "@/components/MediaItemThumb.vue";
import PlaylistAccessSummary from "@/components/PlaylistAccessSummary.vue";
import ProviderIcon from "@/components/ProviderIcon.vue";
import { Button } from "@/components/ui/button";
import { isMusicAssistantPlaylist } from "@/helpers/playlist_access";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatTotalDuration } from "@/helpers/duration";
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

// "Playlist · 32 tracks · 2 h 1 min", without whatever is not known yet
const facts = computed(() => {
  const parts = [$t("playlist")];
  if (props.trackCount) {
    parts.push(
      $t("n_tracks", props.trackCount, { named: { count: props.trackCount } }),
    );
  }
  if (props.duration) parts.push(formatTotalDuration(props.duration));
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
