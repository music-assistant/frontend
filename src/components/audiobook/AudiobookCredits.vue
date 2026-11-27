<template>
  <DetailHeroMetaLine
    v-for="credit in credits"
    :key="credit.role"
    :icon="credit.icon"
    :title="$t(credit.role)"
  >
    <span class="sr-only">{{ $t(credit.role) }}:</span>
    <template v-for="(person, index) in credit.people" :key="index">
      <span v-if="index > 0"> / </span>
      <span v-if="typeof person === 'string'">{{ person }}</span>
      <DetailHeroLink v-else @click="gotoArtist(person, credit.role)">
        {{ person.name }}
      </DetailHeroLink>
    </template>
  </DetailHeroMetaLine>
</template>

<script setup lang="ts">
import DetailHeroLink from "@/components/details/DetailHeroLink.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import {
  AUDIOBOOK_ARTIST_ROUTE,
  type AudiobookArtistRole,
} from "@/helpers/author_narrator";
import type { Artist } from "@/plugins/api/interfaces";
import { Mic, PenLine } from "@lucide/vue";
import { computed } from "vue";
import { useRouter } from "vue-router";

export interface Props {
  authors: (string | Artist)[];
  narrators: (string | Artist)[];
}
const props = defineProps<Props>();

const router = useRouter();

// a provider's artist is a link, a plain name stays text
const credits = computed(() =>
  (
    [
      { role: "authors", icon: PenLine, people: props.authors },
      { role: "narrators", icon: Mic, people: props.narrators },
    ] satisfies {
      role: AudiobookArtistRole;
      icon: typeof PenLine;
      people: (string | Artist)[];
    }[]
  ).filter((credit) => credit.people.length),
);

// the line gives the role, an artist from the library carries no type
const gotoArtist = function (artist: Artist, role: AudiobookArtistRole) {
  router.push({
    name: AUDIOBOOK_ARTIST_ROUTE,
    params: { role, itemId: artist.item_id, provider: artist.provider },
  });
};
</script>
