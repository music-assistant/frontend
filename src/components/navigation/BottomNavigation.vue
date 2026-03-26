<template>
  <nav
    class="fixed bottom-0 left-0 right-0 z-[2000] flex items-center justify-around bg-background"
    style="height: 60px"
    role="navigation"
  >
    <button
      class="nav-btn"
      aria-label="Menu"
      tabindex="0"
      @click="handleMenuClick"
    >
      <Menu class="w-5 h-5" />
      <span class="menuButton">Menu</span>
    </button>

    <button
      class="nav-btn"
      :class="{ 'nav-btn--active': isActive('discover') }"
      :aria-label="$t('discover')"
      tabindex="0"
      @click="handleDiscoverClick"
    >
      <Compass class="w-5 h-5" :stroke-width="isActive('discover') ? 2.5 : 2" />
      <span
        class="menuButton"
        :class="{ 'menuButton--active': isActive('discover') }"
        >{{ $t("discover") }}</span
      >
    </button>

    <button
      class="nav-btn"
      :class="{ 'nav-btn--active': isActive('search') }"
      :aria-label="$t('search')"
      tabindex="0"
      @click="handleSearchClick"
    >
      <Search class="w-5 h-5" :stroke-width="isActive('search') ? 2.5 : 2" />
      <span
        class="menuButton"
        :class="{ 'menuButton--active': isActive('search') }"
        >{{ $t("search") }}</span
      >
    </button>

    <ActivePlayerPopover
      auto-show
      align="end"
      child-element-id="active-player-popover"
    />

    <button
      id="active-player-popover"
      class="nav-btn"
      :aria-label="$t('players')"
      tabindex="0"
      @click="handlePlayersClick"
    >
      <Speaker class="w-5 h-5" />
      <span class="menuButton">{{ $t("players") }}</span>
    </button>
  </nav>
</template>

<script setup lang="ts">
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Compass, Menu, Search, Speaker } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import ActivePlayerPopover from "@/components/ActivePlayerPopover.vue";

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

const handlePlayersClick = () => {
  store.showPlayersMenu = !store.showPlayersMenu;
};

function closePlayersMenu() {
  store.showPlayersMenu = false;
}
</script>

<style scoped>
.nav-btn {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  flex: 1;
  height: 100%;
  background: none;
  border: none;
  color: inherit;
  cursor: pointer;
  opacity: 0.7;
  transition: opacity 0.15s ease;
  padding: 0;
  -webkit-tap-highlight-color: transparent;
}

.nav-btn--active {
  opacity: 1;
}

.nav-btn:hover {
  opacity: 1;
}

.menuButton {
  font-weight: 350;
  font-size: x-small;
  font-stretch: condensed;
  text-transform: none;
  margin-top: 5px;
}

.menuButton--active {
  font-weight: 600;
}
</style>
