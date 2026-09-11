<template>
  <!-- lifts the player off the content by blurring what scrolls under it,
       fading out towards the top so there is no hard edge -->
  <div v-if="store.mobileLayout" class="player-scrim"></div>

  <!-- bottom navigation for mobile layout -->
  <BottomNavigation v-if="store.mobileLayout" />

  <v-footer
    ref="playerBar"
    app
    color="default"
    :class="`py-0 px-0 ${
      store.mobileLayout
        ? 'mediacontrols-player-float'
        : 'mediacontrols-player-default'
    }`"
    :style="{
      bottom: store.mobileLayout
        ? 'var(--mobile-navigation-height)'
        : 'var(--device-inset-bottom)',
    }"
  >
    <Player :use-floating-player="store.mobileLayout" />
  </v-footer>
</template>

<script setup lang="ts">
import BottomNavigation from "@/components/navigation/BottomNavigation.vue";
import { store } from "@/plugins/store";
import { useElementSize } from "@vueuse/core";
import {
  type ComponentPublicInstance,
  onBeforeUnmount,
  ref,
  watchEffect,
} from "vue";
import Player from "./PlayerOSD/Player.vue";

const OVERLAY_HEIGHT_PROPERTY = "--player-bar-overlay-height";
const OVERLAY_MARKER_ATTRIBUTE = "data-player-bar-overlay";

const playerBar = ref<ComponentPublicInstance>();
const { height: playerBarHeight } = useElementSize(playerBar, undefined, {
  box: "border-box",
});

// on mobile the player bar floats on top of the player bar popouts, which read
// this marker and height to keep their content clear of it
watchEffect(() => {
  if (!store.mobileLayout) {
    clearOverlay();
    return;
  }

  document.documentElement.style.setProperty(
    OVERLAY_HEIGHT_PROPERTY,
    `${Math.ceil(playerBarHeight.value)}px`,
  );
  document.documentElement.setAttribute(OVERLAY_MARKER_ATTRIBUTE, "");
});

// the popouts outlive the player bar in frameless mode, so they must not keep
// reserving room for a bar that is no longer there
onBeforeUnmount(clearOverlay);

function clearOverlay() {
  document.documentElement.style.removeProperty(OVERLAY_HEIGHT_PROPERTY);
  document.documentElement.removeAttribute(OVERLAY_MARKER_ATTRIBUTE);
}
</script>

<style>
.mediacontrols-player-float {
  display: flex;
  flex-direction: column;
  /* the card's inset carries the dock's rim, so the surface shows the same
     sliver down both sides as it does above. The vertical margins are omitted:
     the bar is fixed and anchored by its bottom, so they would not move it. */
  margin: 0 calc(var(--mobile-player-inset-x) + var(--device-inset-right)) 0
    calc(var(--mobile-player-inset-x) + var(--device-inset-left));
  width: calc(
    100% - 2 * var(--mobile-player-inset-x) - var(--device-inset-right) -
      var(--device-inset-left)
  ) !important;
  border-radius: 16px !important;
}

.player-scrim {
  position: fixed;
  bottom: 0;
  width: 100%;
  height: var(--mobile-player-scrim-height);
  /* it only exists to soften what is behind it, so it never takes a tap */
  pointer-events: none;
  z-index: 999;
  /* must stay unprefixed: the minifier keeps only the last of a hand-written
     pair, and -webkit-backdrop-filter alone is dead in Chromium */
  backdrop-filter: blur(14px);
  /* the mask is what makes the blur ramp up towards the player instead of
     ending on a visible line */
  mask-image: linear-gradient(
    to top,
    #000 0%,
    #000 35%,
    rgba(0, 0, 0, 0.55) 65%,
    transparent 100%
  );
}

.v-footer {
  z-index: 1000 !important;
}

.v-footer.mediacontrols-player-default {
  padding-right: var(--device-inset-right) !important;
  padding-left: var(--device-inset-left) !important;
  box-shadow: 0 0 4px -1px black;
}

.v-footer.mediacontrols-player-float {
  z-index: 2001 !important;
  /* the footer only positions the player; its own surface would otherwise show
     as opaque wedges outside the player's rounded corners. The paired class
     outweighs the equally-!important bg-default the colour prop brings. */
  background: transparent !important;
}
</style>
