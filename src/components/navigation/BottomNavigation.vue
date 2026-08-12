<template>
  <!-- the label deliberately omits "navigation": screen readers append the
       landmark role, so anything else reads as "... navigation navigation" -->
  <nav
    class="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-[2000] flex"
    :data-picker-open="store.showPlayersMenu"
    :aria-label="$t('main_navigation')"
  >
    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item mobile-navigation-item--bare px-1"
      :aria-label="$t('menu')"
      @click="handleMenuClick"
    >
      <span class="mobile-navigation-icon">
        <Menu :stroke-width="1.6" class="size-8" />
      </span>
    </Button>

    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item min-w-0 flex-1 px-1"
      :data-active="isActive('discover')"
      :aria-current="isActive('discover') ? 'page' : undefined"
      :aria-label="$t('discover')"
      @click="handleDiscoverClick"
    >
      <span class="mobile-navigation-icon">
        <Compass class="size-7" :stroke-width="1.6" />
      </span>
      <span class="mobile-navigation-label">
        {{ $t("discover") }}
      </span>
    </Button>

    <PlayerBarPlayerButton navigation />

    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item mobile-navigation-item--bare px-1"
      :data-active="isActive('search')"
      :aria-current="isActive('search') ? 'page' : undefined"
      :aria-label="$t('search')"
      @click="handleSearchClick"
    >
      <span class="mobile-navigation-icon">
        <Search
          class="size-8"
          :stroke-width="
            isActive('search') && !store.showPlayersMenu ? 2.2 : 1.6
          "
        />
      </span>
    </Button>
  </nav>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import PlayerBarPlayerButton from "@/layouts/default/PlayerOSD/PlayerBarPlayerButton.vue";
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Compass, Menu, Search } from "@lucide/vue";
import { useRoute, useRouter } from "vue-router";

const router = useRouter();
const route = useRoute();

const isActive = (name: string) => route.name === name;

const handleMenuClick = () => {
  closePlayersMenu();
  eventbus.emit("mobile-sidebar-open");
};

const handleDiscoverClick = () => {
  closePlayersMenu();
  router.push({ name: "discover" });
};

const handleSearchClick = () => {
  closePlayersMenu();

  if (isActive("search")) {
    const wrapper = document.getElementById("searchInput");
    if (wrapper) {
      const input = wrapper.querySelector("input") || wrapper;
      (input as HTMLInputElement).focus();
      (input as HTMLInputElement).select();
    }
  } else {
    router.push({ name: "search" });
  }
};

function closePlayersMenu() {
  store.showPlayersMenu = false;
}
</script>

<style>
/* :root lifts this above the equally-!important inset utilities the bar carries */
:root .mobile-bottom-navigation {
  right: calc(12px + var(--device-inset-right)) !important;
  bottom: var(--mobile-navigation-inset-bottom) !important;
  left: calc(12px + var(--device-inset-left)) !important;
  height: var(--mobile-navigation-item-height);
  /* the device insets are already covered by left/right, so this only keeps the
     two icon-only ends off the rounded corners */
  padding-inline: 12px !important;
}

/* one surface for the whole dock: it reaches up behind the player, which then
   sits on it as its own card. The player's measured height is published by the
   footer, so the two always meet. Only a tint - the blur comes from the scrim
   behind it, which ramps up from above the player. */
.mobile-bottom-navigation::before {
  position: absolute;
  z-index: -1;
  top: calc(
    -1 * (var(--player-bar-overlay-height, 0px) + var(--mobile-dock-rim))
  );
  pointer-events: none;
  right: 0;
  bottom: 0;
  left: 0;
  /* the top stays concentric with the player card sitting on it; the bottom is
     far rounder so it does not fight the screen's own corner curve */
  border-radius: 20px 20px 32px 32px;
  background: color-mix(in srgb, var(--background) 70%, transparent);
  box-shadow:
    0 10px 15px -3px rgb(0 0 0 / 0.1),
    0 4px 6px -4px rgb(0 0 0 / 0.1);
  content: "";
}

/* darker than the muted grey the player controls use elsewhere, so the labels
   hold their own against the blurred content behind them. The active item is
   left out so it keeps the primary colour, and hover is pinned here: iOS holds
   hover after a tap, which would otherwise leave an item looking active. */
.mobile-bottom-navigation .player-control-button:not([data-active="true"]),
.mobile-bottom-navigation
  .player-control-button:not([data-active="true"]):hover:not(
    [data-suppress-hover="true"]
  ) {
  color: color-mix(in srgb, var(--foreground) 80%, transparent) !important;
}

/* an open picker is the active item, so the page underneath gives up both the
   colour and the weight and only one thing in the bar ever reads as active */
.mobile-bottom-navigation[data-picker-open="true"]
  .player-control-button[data-active="true"]:not(#player-select-button) {
  color: color-mix(in srgb, var(--foreground) 80%, transparent) !important;
}

.mobile-bottom-navigation:not([data-picker-open="true"])
  .player-control-button[data-active="true"]:not(#player-select-button)
  .mobile-navigation-label,
.mobile-bottom-navigation
  #player-select-button[data-active="true"]
  .mobile-navigation-label {
  font-weight: 600;
}

/* the paired class outweighs the equally-!important layout utilities the button
   brings along with its base and size */
.player-control-button.mobile-navigation-item {
  display: grid !important;
  /* the ring follows the bar's own shape instead of cutting hard verticals
     across it */
  border-radius: 24px !important;
  height: var(--mobile-navigation-item-height) !important;
  grid-template-rows: 30px 16px;
  align-content: center;
  justify-items: center;
  row-gap: 1px !important;
  /* tight, so the buttons sit close to the player bar; the room that keeps them
     clear of the screen edge comes from the bar's own bottom inset */
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}

/* no label, so the icon takes the whole height and the button only claims the
   width it needs */
.player-control-button.mobile-navigation-item--bare {
  width: 60px;
  grid-template-rows: 1fr;
}

.mobile-navigation-icon {
  display: flex;
  height: 30px;
  align-items: center;
  justify-content: center;
}

.mobile-navigation-label {
  display: block;
  width: 100%;
  height: 16px;
  overflow: hidden;
  font-size: 11px;
  font-weight: 400;
  line-height: 16px;
  text-align: center;
  text-overflow: ellipsis;
  white-space: nowrap;
}
</style>
