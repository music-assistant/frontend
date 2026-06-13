<template>
  <button class="ed-genre ma-tap" @click="onClick">
    <img
      class="ed-genre__bg"
      loading="lazy"
      :src="genreBanner"
      alt=""
      aria-hidden="true"
    />
    <div class="ed-genre__scrim"></div>
    <img
      v-if="iconImage"
      class="ed-genre__icon"
      loading="lazy"
      :src="iconImage"
      alt=""
      aria-hidden="true"
    />
    <div class="ed-genre__content">
      <div class="ed-genre__name">{{ displayName }}</div>
    </div>
  </button>
</template>

<script setup lang="ts">
import { itemArtwork } from "@/components/discover/editorialArtwork";
import { handleMediaItemClick } from "@/helpers/utils";
import type { Genre } from "@/plugins/api/interfaces";
import { computed } from "vue";
import { useI18n } from "vue-i18n";

interface Props {
  item: Genre;
}
const props = defineProps<Props>();
const { t, te } = useI18n();

const genreBanner = new URL("@/assets/logo/banner-no-logo.png", import.meta.url)
  .href;

const iconImage = computed(() => itemArtwork(props.item, 320).image);
const displayName = computed(() => props.item.name);

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
.ed-genre__bg {
  position: absolute;
  inset: 0;
  z-index: 0;
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.ed-genre__scrim {
  position: absolute;
  inset: 0;
  z-index: 1;
  background: linear-gradient(
    to right,
    rgba(0, 0, 0, 0.5) 0%,
    rgba(0, 0, 0, 0.2) 45%,
    transparent 70%
  );
}
.ed-genre__icon {
  position: absolute;
  top: 50%;
  right: 8px;
  z-index: 2;
  width: 72px;
  height: 72px;
  object-fit: contain;
  transform: translateY(-50%);
  filter: brightness(0) invert(1);
  opacity: 1;
  pointer-events: none;
}
.ed-genre__content {
  position: relative;
  z-index: 3;
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
