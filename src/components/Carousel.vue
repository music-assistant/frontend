<template>
  <swiper
    :slides-per-view="panelViewItemResponsive($vuetify.display.width) + 0.5"
    :free-mode="true"
    :navigation="false"
    :mousewheel="{
      forceToAxis: true,
      releaseOnEdges: true,
    }"
    :virtual="{ enabled: true }"
  >
    <swiper-slide
      v-for="(item, index) in items"
      :key="itemKey ? itemKey(item) : index"
      :virtual-index="index"
    >
      <slot :item="item" :index="index"></slot>
    </swiper-slide>
  </swiper>
</template>

<script setup lang="ts" generic="T">
import { panelViewItemResponsive } from "@/helpers/utils";
import { onMounted } from "vue";

defineProps<{
  items: T[];
  itemKey?: (item: T) => string | number;
}>();

defineSlots<{
  default(props: { item: T; index: number }): void;
}>();

onMounted(() => {
  document.documentElement.style.setProperty(
    "--swiper-navigation-color",
    "primary",
  );
});
</script>
