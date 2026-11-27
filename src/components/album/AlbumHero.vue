<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    soften-backdrop
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item" #meta>
      <DetailHeroMetaLine v-if="item.artists.length" :icon="Music">
        <template v-for="(artist, index) in item.artists" :key="artist.uri">
          <span v-if="index > 0">,&nbsp;</span>
          <DetailHeroLink @click="gotoArtist(artist)">
            {{ artist.name }}
          </DetailHeroLink>
        </template>
      </DetailHeroMetaLine>
      <DetailHeroFacts v-if="facts.length" :icon="Disc" :facts="facts" />
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
        :label="$t('album_radio')"
        :disabled="!radioSupported(item)"
        @click="gotoRadio(item)"
      />
      <!-- outside the library the services listed beside already say where it is from -->
      <DetailHeroSourceBadge :item="item" library-only />
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <DetailHeroProviders :item="item" />
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
import DetailHeroLink from "@/components/details/DetailHeroLink.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { formatTotalDuration } from "@/helpers/duration";
import { api } from "@/plugins/api";
import {
  AlbumType,
  type Album,
  type Artist,
  type ItemMapping,
  type SortDirection,
  type SortField,
} from "@/plugins/api/interfaces";
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
  // the order the tracks are listed in below, which the play button follows
  tracksSortField?: SortField;
  tracksSortDirection?: SortDirection;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const router = useRouter();

// "Album · 2011 · 12 tracks · 48 min", without whatever the album does not have
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
  if (props.duration) parts.push(formatTotalDuration(props.duration));
  return parts;
});

const gotoArtist = function (artist: Artist | ItemMapping) {
  router.push({
    name: "artist",
    params: { itemId: artist.item_id, provider: artist.provider },
  });
};
</script>
