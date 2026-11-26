<template>
  <!-- the colour is one the app read from the icon, never anything drawn from it;
       an icon without one gets a light banner in the colours of the theme -->
  <div
    class="relative overflow-hidden"
    :class="light ? 'bg-muted' : GRADIENT_CLASS"
    :style="{ '--catalog-art': color }"
    :data-art="light ? 'light' : 'colour'"
    data-testid="catalog-art"
  >
    <span
      v-for="ring in RINGS"
      :key="ring"
      class="pointer-events-none absolute top-[12%] left-[88%] aspect-square -translate-1/2 rounded-full border"
      :class="[ring, light ? 'border-foreground/5' : 'border-white/15']"
      aria-hidden="true"
    ></span>
    <span
      class="pointer-events-none absolute -bottom-1/3 -left-[8%] aspect-square w-2/5 rounded-full"
      :class="light ? 'bg-foreground/[0.03]' : 'bg-white/10'"
      aria-hidden="true"
    ></span>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { NEUTRAL_ICON_COLOR } from "@/helpers/icon_color";
import { computed } from "vue";

interface Props {
  // the main colour of the entry's icon, as #rrggbb, or the neutral colour
  // when it has none
  color: string;
}

const props = defineProps<Props>();

const GRADIENT_CLASS =
  "bg-[linear-gradient(135deg,var(--catalog-art)_0%,color-mix(in_srgb,var(--catalog-art)_55%,black)_100%)]";
const RINGS = ["w-[30%]", "w-[60%]", "w-[90%]"];

const light = computed(() => props.color === NEUTRAL_ICON_COLOR);
</script>
