<template>
  <!-- an artist has no cover beside its name: its picture fills the hero -->
  <DetailHero :item="item" :backdrop="backdrop" @edit-rows="emit('edit-rows')">
    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
    </template>

    <template v-if="item" #title>
      <DetailHeroTitle :item="item" :logo="artistLogo" />
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
      <DetailHeroButton
        :icon="Shuffle"
        :label="$t('shuffle')"
        :disabled="!store.activePlayer"
        @click="api.playMedia(item, undefined, { shuffle: true })"
      />
      <DetailHeroButton
        v-if="radioRelevant(item)"
        :icon="Orbit"
        :label="$t('artist_radio')"
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
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import { heroBackdrop } from "@/helpers/hero_backdrop";
import { gotoRadio, radioRelevant, radioSupported } from "@/helpers/radio";
import { getImageThumbForItem } from "@/helpers/utils";
import { api } from "@/plugins/api";
import { ImageType, type Artist } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { store } from "@/plugins/store";
import { Orbit, Shuffle } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Artist;
}
const props = defineProps<Props>();

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

// with no cover beside the name, the picture stays sharp even when it is the
// square thumb
const backdrop = computed(() =>
  props.item ? heroBackdrop(props.item).url : undefined,
);

const artistLogo = computed(() =>
  props.item ? getImageThumbForItem(props.item, ImageType.LOGO) : undefined,
);
</script>
