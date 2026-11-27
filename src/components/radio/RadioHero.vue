<template>
  <DetailHero
    :item="item"
    :backdrop="backdrop.url"
    :blur-backdrop="backdrop.blurred"
    @edit-rows="emit('edit-rows')"
  >
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #cover>
      <DetailHeroCover :item="item" />
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
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
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import { heroBackdrop, type HeroBackdrop } from "@/helpers/hero_backdrop";
import type { Radio } from "@/plugins/api/interfaces";
import { computed } from "vue";

export interface Props {
  item?: Radio;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const backdrop = computed<HeroBackdrop>(() =>
  props.item ? heroBackdrop(props.item) : { blurred: false },
);
</script>
