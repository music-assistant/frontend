<template>
  <!-- a genre has no cover beside its name: its picture fills the hero -->
  <DetailHero
    :item="item"
    :backdrop="backdrop"
    :editable-rows="editableRows"
    @edit-rows="emit('edit-rows')"
  >
    <!-- the name is all a genre hero has, so it shows whole -->
    <template v-if="item" #title>
      <DetailHeroTitle :item="item" :clamp="false" />
    </template>

    <template #toolbar-append>
      <DetailHeroFavorite v-if="item" :item="item" />
      <slot name="toolbar-append" />
    </template>

    <template v-if="item" #actions>
      <DetailHeroPlayButton :item="item" />
      <DetailHeroButton
        v-if="canManageGenre"
        :icon="Merge"
        :label="$t('merge_into')"
        @click="mergeGenre"
      />
      <DetailHeroButton
        v-if="canManageGenre"
        :icon="Trash2"
        :label="$t('delete_genre')"
        @click="deleteGenre"
      />
      <DetailHeroSourceBadge :item="item" />
    </template>
  </DetailHero>
</template>

<script setup lang="ts">
import DetailHero from "@/components/details/DetailHero.vue";
import DetailHeroButton from "@/components/details/DetailHeroButton.vue";
import DetailHeroFavorite from "@/components/details/DetailHeroFavorite.vue";
import DetailHeroPlayButton from "@/components/details/DetailHeroPlayButton.vue";
import DetailHeroSourceBadge from "@/components/details/DetailHeroSourceBadge.vue";
import DetailHeroTitle from "@/components/details/DetailHeroTitle.vue";
import { heroBackdrop } from "@/helpers/hero_backdrop";
import { Scope, type Genre } from "@/plugins/api/interfaces";
import { authManager } from "@/plugins/auth";
import { eventbus } from "@/plugins/eventbus";
import { $t } from "@/plugins/i18n";
import { Merge, Trash2 } from "@lucide/vue";
import { computed } from "vue";

export interface Props {
  item?: Genre;
  editableRows?: boolean;
}
const props = withDefaults(defineProps<Props>(), {
  item: undefined,
  editableRows: false,
});

const emit = defineEmits<{
  (e: "edit-rows"): void;
}>();

const canManageGenre = computed(
  () =>
    props.item?.provider === "library" &&
    authManager.hasScope(Scope.LIBRARY_MANAGE),
);

// with no cover beside the name, the picture stays sharp even when it is the
// square thumb
const backdrop = computed(() =>
  props.item ? heroBackdrop(props.item).url : undefined,
);

const mergeGenre = () => {
  const genre = props.item;
  if (!genre || !canManageGenre.value) return;
  eventbus.emit("mergeGenreDialog", {
    genreIds: [genre.item_id],
    genreNames: [genre.name],
    genreContentTypes: [genre.content_type],
  });
};

const deleteGenre = () => {
  const genre = props.item;
  if (!genre || !canManageGenre.value) return;
  eventbus.emit("deleteGenreDialog", {
    genreIds: [genre.item_id],
    navigateBack: true,
  });
};
</script>
