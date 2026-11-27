<template>
  <!-- the colour is one the app read from the icon, never anything drawn from it;
       an icon without one gets a light banner in the colours of the theme, and
       an error a pale red one -->
  <div
    class="relative overflow-hidden"
    :class="BACKGROUND_CLASS[art]"
    :style="color ? { '--catalog-art': color } : undefined"
    :data-art="art"
    data-testid="catalog-art"
  >
    <!-- border-[1px] rather than border, which Vuetify colours over -->
    <span
      v-for="ring in RINGS"
      :key="ring"
      class="pointer-events-none absolute top-[12%] left-[88%] aspect-square -translate-1/2 rounded-full border-[1px]"
      :class="[ring, RING_CLASS[art]]"
      aria-hidden="true"
    ></span>
    <span
      class="pointer-events-none absolute -bottom-1/3 -left-[8%] aspect-square w-2/5 rounded-full"
      :class="BLOB_CLASS[art]"
      aria-hidden="true"
    ></span>
    <slot />
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";

type Art = "colour" | "light" | "error";

interface Props {
  // the main colour of the entry's icon, as #rrggbb; null when it has none
  color: string | null;
  // whether the entry is in error, which the banner says in place of its colour
  error?: boolean;
}

const props = defineProps<Props>();

const BACKGROUND_CLASS: Record<Art, string> = {
  colour:
    "bg-[linear-gradient(135deg,var(--catalog-art)_0%,color-mix(in_srgb,var(--catalog-art)_55%,black)_100%)]",
  light: "bg-muted",
  error: "bg-destructive/12",
};
const RING_CLASS: Record<Art, string> = {
  colour: "border-white/15",
  light: "border-foreground/5",
  error: "border-destructive/10",
};
const BLOB_CLASS: Record<Art, string> = {
  colour: "bg-white/10",
  light: "bg-foreground/[0.03]",
  error: "bg-destructive/5",
};
const RINGS = ["w-[30%]", "w-[60%]", "w-[90%]"];

const art = computed((): Art => {
  if (props.error) return "error";
  return props.color ? "colour" : "light";
});
</script>
