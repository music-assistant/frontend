<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :blur-backdrop="blurBackdrop"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item && (item.publisher || episodeCount != null)" #meta>
      <DetailHeroMetaLine v-if="item.publisher" :icon="Mic">
        {{ item.publisher }}
      </DetailHeroMetaLine>
      <DetailHeroMetaLine v-if="episodeCount != null" :icon="PodcastIcon">
        {{ $t("n_episodes", episodeCount, { named: { count: episodeCount } }) }}
      </DetailHeroMetaLine>
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
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
import DetailHeroCover from "@/components/details/DetailHeroCover.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import type { Podcast } from "@/plugins/api/interfaces";
import { Mic, PodcastIcon } from "@lucide/vue";

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

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();
</script>
