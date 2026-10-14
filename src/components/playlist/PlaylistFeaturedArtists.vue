<template>
  <ArtistSimilarShelf
    v-if="ranked.length"
    :title="$t('featured_artists')"
    :items="artists"
  />
</template>

<script setup lang="ts">
import ArtistSimilarShelf from "@/components/artist/ArtistSimilarShelf.vue";
import { rankFeaturedArtists } from "@/helpers/featured_artists";
import { api } from "@/plugins/api";
import type { PlaylistItem } from "@/components/playlist/playlistData";
import type { Artist, ItemMapping } from "@/plugins/api/interfaces";
import { computed, ref, watch } from "vue";

export interface Props {
  // undefined until the playlist's tracks have loaded
  tracks?: PlaylistItem[];
}
const props = defineProps<Props>();

const FEATURED_ARTIST_COUNT = 12;

const ranked = computed(() =>
  props.tracks ? rankFeaturedArtists(props.tracks, FEATURED_ARTIST_COUNT) : [],
);

// undefined while the full artists load, which shows the row's skeletons
const artists = ref<Array<Artist | ItemMapping>>();
let latestRequest = 0;

// the tracks only name their artists, so the full artists are fetched for their
// images; one that fails to load still shows by name
watch(
  () => ranked.value.map((artist) => artist.uri).join(),
  async () => {
    const wanted = ranked.value;
    const request = ++latestRequest;
    artists.value = undefined;
    const results = await Promise.allSettled(
      wanted.map((artist) => api.getArtist(artist.item_id, artist.provider)),
    );
    // a newer set of artists replaced these while they loaded
    if (request !== latestRequest) return;
    artists.value = results.map((result, index) =>
      result.status === "fulfilled" ? result.value : wanted[index],
    );
  },
  { immediate: true },
);
</script>
