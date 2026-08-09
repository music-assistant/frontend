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
        <Menu :stroke-width="1.6" class="size-8" />
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
          class="size-8"
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
        <Search class="size-8" :stroke-width="isActive('search') ? 2 : 1.6" />
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
.mobile-bottom-navigation {
  bottom: -2px !important;
  height: calc(90px + env(safe-area-inset-bottom, 0px));
  background: var(--background);
  padding-bottom: calc(2px + env(safe-area-inset-bottom, 0px));
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

.mobile-navigation-item {
  display: grid !important;
  height: 88px !important;
  grid-template-rows: 38px 16px;
  align-content: center;
  justify-items: center;
  row-gap: 4px !important;
  padding-top: 7px !important;
  padding-bottom: 23px !important;
}

.mobile-navigation-icon {
  display: flex;
  height: 38px;
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
