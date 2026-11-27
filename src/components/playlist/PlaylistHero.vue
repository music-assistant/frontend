<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
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

    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item" #meta>
      <DetailHeroMetaLine
        v-if="isMusicAssistantPlaylist(item) || item.owner"
        :icon="User"
      >
        <PlaylistAccessSummary
          v-if="isMusicAssistantPlaylist(item)"
          :playlist="item"
        />
        <template v-else>{{ item.owner }}</template>
      </DetailHeroMetaLine>
      <DetailHeroFacts :icon="ListMusic" :facts="facts" />
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton
        :item="item"
        :tracks-sort-field="tracksSortField"
        :tracks-sort-direction="tracksSortDirection"
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
      <DetailHeroSourceBadge :item="item" />
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroCover from "@/components/details/DetailHeroCover.vue";
import DetailHeroFacts from "@/components/details/DetailHeroFacts.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import PlaylistAccessSummary from "@/components/PlaylistAccessSummary.vue";
import { Button } from "@/components/ui/button";
import { isMusicAssistantPlaylist } from "@/helpers/playlist_access";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatTotalDuration } from "@/helpers/duration";
import { api } from "@/plugins/api";
import type {
  Playlist,
  SortDirection,
  SortField,
} from "@/plugins/api/interfaces";
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
  tracksSortField?: SortField;
  tracksSortDirection?: SortDirection;
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
</script>
