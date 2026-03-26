<template>
  <swiper
    :slides-per-view="panelViewItemResponsive(windowWidth) + 0.5"
    :free-mode="true"
    :navigation="false"
    :mousewheel="{
      forceToAxis: true,
      releaseOnEdges: true,
    }"
  >
    <slot></slot>
  </swiper>
</template>

<script setup lang="ts">
import { panelViewItemResponsive } from "@/helpers/utils";
import { useBreakpoint } from "@/composables/useBreakpoint";
import { onMounted } from "vue";

const { width: windowWidth } = useBreakpoint();

onMounted(() => {
  document.documentElement.style.setProperty(
    "--swiper-navigation-color",
    "primary",
  );
});
</script>
