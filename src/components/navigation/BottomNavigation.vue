<template>
  <v-bottom-navigation
    :height="height"
    bg-color="default"
    grow
    role="navigation"
  >
    <v-btn
      aria-label="Menu"
      tabindex="0"
      variant="text"
      base-color="grey"
      @click="handleMenuClick"
    >
      <Menu class="w-5 h-5" />
      <span class="menuButton">Menu</span>
    </v-btn>

    <v-btn
      :aria-label="$t('discover')"
      tabindex="0"
      variant="text"
      active-color="fg"
      base-color="grey"
      @click="handleDiscoverClick"
    >
      <Home class="w-5 h-5" />
      <span class="menuButton">{{ $t("discover") }}</span>
    </v-btn>

    <v-btn
      :aria-label="$t('players')"
      tabindex="0"
      variant="text"
      base-color="grey"
      @click="handlePlayersClick"
    >
      <Volume2 class="w-5 h-5" />
      <span class="menuButton">{{ $t("players") }}</span>
    </v-btn>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Home, Menu, Volume2 } from "lucide-vue-next";
import { useRouter } from "vue-router";

export interface Props {
  height: number;
}
defineProps<Props>();

const router = useRouter();

const handleMenuClick = () => {
  eventbus.emit("mobile-sidebar-open");
};

const handleDiscoverClick = () => {
  router.push({ name: "home" });
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

.v-btn--active > .v-btn__overlay {
  background: rgb(var(--v-theme-default)) !important;
}

.v-slide-group-item--active {
  opacity: 100%;
}
</style>
