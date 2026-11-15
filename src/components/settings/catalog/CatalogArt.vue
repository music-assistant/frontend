<template>
  <!-- the colour is one the app read from the icon, never anything drawn from it -->
  <div
    class="relative overflow-hidden bg-[linear-gradient(135deg,var(--catalog-art)_0%,color-mix(in_srgb,var(--catalog-art)_55%,black)_100%)]"
    :style="{ '--catalog-art': color }"
    data-testid="catalog-art"
  >
    <span
      v-for="ring in RINGS"
      :key="ring"
      class="pointer-events-none absolute top-[12%] left-[88%] aspect-square -translate-1/2 rounded-full border border-white/15"
      :class="ring"
      aria-hidden="true"
    ></span>
    <span
      class="pointer-events-none absolute -bottom-1/3 -left-[8%] aspect-square w-2/5 rounded-full bg-white/10"
      aria-hidden="true"
    ></span>
    <slot></slot>
  </div>
</template>

<script setup lang="ts">
interface Props {
  // the main colour of the entry's icon, as #rrggbb
  color: string;
}

defineProps<Props>();

const RINGS = ["w-[30%]", "w-[60%]", "w-[90%]"];
</script>
