<template>
  <!-- the colour is one the app read from the icon, never anything drawn from it;
       an icon without one gets a light banner in the colours of the theme -->
  <div
    class="relative overflow-hidden"
    :class="light ? 'bg-muted' : GRADIENT_CLASS"
    :style="color ? { '--catalog-art': color } : undefined"
    :data-art="light ? 'light' : 'colour'"
    data-testid="catalog-art"
  >
    <!-- border-[1px] rather than border, which Vuetify colours over -->
    <span
      v-for="ring in RINGS"
      :key="ring"
      class="pointer-events-none absolute top-[12%] left-[88%] aspect-square -translate-1/2 rounded-full border-[1px]"
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
import { computed } from "vue";

interface Props {
  // the main colour of the entry's icon, as #rrggbb; null when it has none
  color: string | null;
}

const props = defineProps<Props>();

const GRADIENT_CLASS =
  "bg-[linear-gradient(135deg,var(--catalog-art)_0%,color-mix(in_srgb,var(--catalog-art)_55%,black)_100%)]";
const RINGS = ["w-[30%]", "w-[60%]", "w-[90%]"];

const light = computed(() => !props.color);
</script>
