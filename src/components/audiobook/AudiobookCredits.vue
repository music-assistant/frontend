<template>
  <div
    v-for="credit in credits"
    :key="credit.label"
    class="flex min-w-0 items-center gap-2"
    :title="$t(credit.label)"
  >
    <component
      :is="credit.icon"
      :size="16"
      class="flex-none"
      aria-hidden="true"
    />
    <span class="sr-only">{{ $t(credit.label) }}:</span>
    <span class="min-w-0 truncate">
      <template v-for="(person, index) in credit.people" :key="index">
        <span v-if="index > 0"> / </span>
        <span v-if="typeof person === 'string'">{{ person }}</span>
        <button
          v-else
          type="button"
          class="inline cursor-pointer border-0 bg-transparent p-0 align-baseline text-inherit [font:inherit] hover:underline focus-visible:rounded focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
          @click="gotoArtist(person)"
        >
          {{ person.name }}
        </button>
      </template>
    </span>
  </div>
</template>

<script setup lang="ts">
import { AUDIOBOOK_ARTIST_ROUTE } from "@/helpers/author_narrator";
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
  [
    { label: "authors", icon: PenLine, people: props.authors },
    { label: "narrators", icon: Mic, people: props.narrators },
  ].filter((credit) => credit.people.length),
);

const gotoArtist = function (artist: Artist) {
  router.push({
    name: AUDIOBOOK_ARTIST_ROUTE,
    params: { itemId: artist.item_id, provider: artist.provider },
  });
};
</script>
