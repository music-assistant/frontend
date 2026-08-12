<template>
  <nav
    class="mobile-bottom-navigation fixed inset-x-0 bottom-0 z-[2000] flex border-t px-1 shadow-lg"
    aria-label="Main navigation"
  >
    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item min-w-0 flex-1 rounded-none px-1"
      aria-label="Menu"
      @click="handleMenuClick"
    >
      <span class="mobile-navigation-icon">
        <Menu :stroke-width="1.6" class="size-7" />
      </span>
      <span class="mobile-navigation-label"> Menu </span>
    </Button>

    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item min-w-0 flex-1 rounded-none px-1"
      :data-active="isActive('discover')"
      :aria-label="$t('discover')"
      @click="handleDiscoverClick"
    >
      <span class="mobile-navigation-icon">
        <Compass
          class="size-7"
          :stroke-width="isActive('discover') ? 2 : 1.6"
        />
      </span>
      <span class="mobile-navigation-label">
        {{ $t("discover") }}
      </span>
    </Button>

    <Button
      variant="ghost"
      class="player-control-button mobile-navigation-item min-w-0 flex-1 rounded-none px-1"
      :data-active="isActive('search')"
      :aria-label="$t('search')"
      @click="handleSearchClick"
    >
      <span class="mobile-navigation-icon">
        <Search class="size-7" :stroke-width="isActive('search') ? 2 : 1.6" />
      </span>
      <span class="mobile-navigation-label">
        {{ $t("search") }}
      </span>
    </Button>

    <PlayerBarGroupControl navigation />
    <PlayerBarPlayerButton navigation />
  </nav>
</template>

<script setup lang="ts">
import { Button } from "@/components/ui/button";
import PlayerBarGroupControl from "@/layouts/default/PlayerOSD/PlayerBarGroupControl.vue";
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
/* :root lifts this above the equally-!important bottom and padding utilities
   the bar carries */
:root .mobile-bottom-navigation {
  bottom: -2px !important;
  height: calc(var(--mobile-navigation-height) + 2px);
  background: var(--background);
  padding-right: calc(0.25rem + var(--device-inset-right)) !important;
  padding-bottom: calc(var(--mobile-navigation-inset-bottom) + 2px);
  padding-left: calc(0.25rem + var(--device-inset-left)) !important;
}

.mobile-bottom-navigation::before {
  position: absolute;
  top: -2px;
  right: 0;
  left: 0;
  height: 2px;
  background: var(--background);
  content: "";
}

/* the paired class outweighs the equally-!important layout utilities the button
   brings along with its base and size */
.player-control-button.mobile-navigation-item {
  display: grid !important;
  height: var(--mobile-navigation-item-height) !important;
  grid-template-rows: 34px 16px;
  align-content: center;
  justify-items: center;
  row-gap: 4px !important;
  /* tight, so the buttons sit close to the player bar; the room that keeps them
     clear of the screen edge comes from the bar's own bottom inset */
  padding-top: 2px !important;
  padding-bottom: 2px !important;
}

.mobile-navigation-icon {
  display: flex;
  height: 34px;
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
