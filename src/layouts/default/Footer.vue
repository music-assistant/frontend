<template>
  <!-- gradient background panel to make the footer player more elevated (and hide content behind it)-->
  <div
    v-if="store.mobileLayout"
    :class="$vuetify.theme.current.dark ? 'gradient-dark' : 'gradient-light'"
    :style="`
      position: fixed;
      width: 100%;
      height: calc(180px + var(--mobile-navigation-inset-bottom));
      bottom: 0px;
      z-index: 999;
    `"
  ></div>

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
    :style="[
      store.mobileLayout ? { bottom: 'var(--mobile-navigation-height)' } : {},
      store.mobileLayout && store.showPlayersMenu
        ? 'z-index: 999 !important;'
        : '',
    ]"
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
  margin: 5px;
  margin-bottom: 6px;
  width: calc(100% - 10px) !important;
  border-radius: 10px !important;
}

.gradient-dark {
  background: linear-gradient(
    0deg,
    rgba(0, 0, 0, 0.9) 0%,
    rgba(0, 0, 0, 0.9) 75%,
    rgba(255, 255, 255, 0) 100%
  );
}
.gradient-light {
  background: linear-gradient(
    0deg,
    rgba(255, 255, 255, 0.9) 0%,
    rgba(255, 255, 255, 0.9) 75%,
    rgba(255, 255, 255, 0) 100%
  );
}

.v-footer {
  z-index: 1000 !important;
}

.v-footer.mediacontrols-player-float {
  z-index: 2001 !important;
}
</style>
