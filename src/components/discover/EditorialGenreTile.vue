<template>
  <button
    class="ed-genre ma-tap"
    :style="{ background: art.gradient }"
    @click="onClick"
  >
    <img
      v-if="art.image"
      class="ed-genre__img"
      loading="lazy"
      :src="art.image"
      :alt="item.name"
    />
    <div class="ed-genre__scrim"></div>
    <div class="ed-genre__content">
      <div class="ed-genre__name">{{ displayName }}</div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { itemArtwork } from "@/components/discover/editorialArtwork";
import { getGenreDisplayName, handleMediaItemClick } from "@/helpers/utils";
import type { Genre } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: Genre;
}
const props = defineProps<Props>();
const { t, te } = useI18n();

const art = computed(() => itemArtwork(props.item, 320));
const displayName = computed(() =>
  getGenreDisplayName(props.item.name, props.item.translation_key, t, te),
);

const onClick = (e: MouseEvent) =>
  handleMediaItemClick(props.item, e.clientX, e.clientY);
</script>

<style scoped>
.ed-genre {
  position: relative;
  overflow: hidden;
  height: 84px;
  border-radius: 16px;
  border: none;
  cursor: pointer;
  text-align: left;
  color: #fff;
  transition: transform 0.18s ease;
}
.ed-genre:hover {
  transform: translateY(-2px);
}
.ma-tap:active {
  transform: scale(0.97);
}
.ed-genre__img {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ed-genre__scrim {
  position: absolute;
  inset: 0;
  background: linear-gradient(
    135deg,
    rgba(0, 0, 0, 0.1) 0%,
    rgba(0, 0, 0, 0.55) 100%
  );
}
.ed-genre__content {
  position: relative;
  z-index: 1;
  height: 100%;
  padding: 14px 16px;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
}
.ed-genre__name {
  font-size: 18px;
  font-weight: 800;
  letter-spacing: -0.4px;
}
</style>
