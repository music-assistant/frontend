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

    <template v-if="item" #meta>
      <AudiobookCredits :authors="item.authors" :narrators="item.narrators" />
      <DetailHeroMetaLine v-if="item.duration > 0" :icon="Timer">
        {{ formatDuration(item.duration) }}
      </DetailHeroMetaLine>
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
      <DetailHeroPlayedState v-if="playedState" :item="item" />
      <span
        v-if="!item.fully_played && position > 0"
        class="text-sm text-white/85"
      >
        {{ formatDuration(position) }}
      </span>
    </template>

    <template v-if="item && progress !== undefined" #footer>
      <Progress
        :model-value="progress"
        :aria-label="
          $t(item.fully_played ? 'item_fully_played' : 'item_in_progress')
        "
        class="h-1 max-w-80 bg-white/20"
      />
    </template>

    <template v-if="item" #aside>
      <DetailHeroGenres :item="item" />
      <DetailHeroProviders :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import AudiobookCredits from "@/components/audiobook/AudiobookCredits.vue";
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroCover from "@/components/details/DetailHeroCover.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroGenres from "@/components/details/DetailHeroGenres.vue";
import DetailHeroMetaLine from "@/components/details/DetailHeroMetaLine.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroPlayedState from "@/components/details/DetailHeroPlayedState.vue";
import DetailHeroProviders from "@/components/details/DetailHeroProviders.vue";
import { Progress } from "@/components/ui/progress";
import { getPlayedState } from "@/helpers/played_state";
import { heroBackdrop, type HeroBackdrop } from "@/helpers/hero_backdrop";
import { formatDuration } from "@/helpers/utils";
import type { Audiobook } from "@/plugins/api/interfaces";
import { Timer } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Audiobook;
}
const props = defineProps<Props>();
const emit = defineEmits<{ (e: "edit-rows"): void }>();

const backdrop = computed<HeroBackdrop>(() =>
  props.item ? heroBackdrop(props.item) : { blurred: false },
);
const playedState = computed(() =>
  props.item ? getPlayedState(props.item) : undefined,
);
const position = computed(() =>
  Math.max(0, (props.item?.resume_position_ms ?? 0) / 1000),
);
const progress = computed(() => {
  const item = props.item;
  if (!item || !(item.duration > 0)) return undefined;
  if (item.fully_played) return 100;
  if (!position.value) return undefined;
  return Math.min(100, (position.value / item.duration) * 100);
});
</script>
