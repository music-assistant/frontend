<template>
  <v-bottom-navigation
    app
    height="60"
    bg-color="default"
    grow
    role="navigation"
  >
    <v-btn
      aria-label="Menu"
      tabindex="0"
      variant="text"
      @click="handleMenuClick"
    >
      <Menu class="w-5 h-5" />
      <span class="menuButton">Menu</span>
    </v-btn>

    <v-btn
      :aria-label="$t('discover')"
      tabindex="0"
      variant="text"
      :active="isActive('discover')"
      active-color="fg"
      @click="handleDiscoverClick"
    >
      <Home class="w-5 h-5" :stroke-width="isActive('discover') ? 2.5 : 2" />
      <span
        class="menuButton"
        :class="{ 'menuButton--active': isActive('discover') }"
        >{{ $t("discover") }}</span
      >
    </v-btn>

    <v-btn
      :aria-label="$t('search')"
      tabindex="0"
      variant="text"
      :active="isActive('search')"
      active-color="fg"
      @click="handleSearchClick"
    >
      <Search class="w-5 h-5" :stroke-width="isActive('search') ? 2.5 : 2" />
      <span
        class="menuButton"
        :class="{ 'menuButton--active': isActive('search') }"
        >{{ $t("search") }}</span
      >
    </v-btn>

    <ActivePlayerPopover
      auto-show
      align="end"
      child-element-id="active-player-popover"
    >
      <template #trigger>
        <v-btn
          id="active-player-popover"
          :aria-label="$t('players')"
          tabindex="0"
          variant="text"
          @click="handlePlayersClick"
        >
          <Speaker class="w-5 h-5" />
          <span class="menuButton">{{ $t("players") }}</span>
        </v-btn>
      </template>
    </ActivePlayerPopover>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Home, Menu, Search, Speaker } from "lucide-vue-next";
import { useRoute, useRouter } from "vue-router";
import ActivePlayerPopover from "@/components/ActivePlayerPopover.vue";

const router = useRouter();
const route = useRoute();

const isActive = (name: string) => route.name === name;

const handleMenuClick = () => {
  eventbus.emit("mobile-sidebar-open");
};

const handleDiscoverClick = () => {
  router.push({ name: "discover" });
};

const handleSearchClick = () => {
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
  store.showPlayersMenu = true;
};
</script>

<style>
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

.v-btn--active > .v-btn__overlay {
  background: rgb(var(--v-theme-default)) !important;
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>
