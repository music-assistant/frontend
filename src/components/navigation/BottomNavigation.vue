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
      v-for="menuItem of menuItems.filter((x) => !x.isLibraryNode && !x.hidden)"
      :key="menuItem.label"
      :to="menuItem.path"
      :aria-label="$t(menuItem.label)"
      tabindex="0"
      variant="text"
      active-color="fg"
      base-color="grey"
    >
      <component :is="menuItem.icon" class="w-6 h-6" />
      <span class="menuButton">{{ $t(menuItem.label) }}</span>
    </v-btn>

    <v-btn
      :aria-label="$t('discover')"
      tabindex="0"
      variant="text"
      active-color="fg"
      @click="handleDiscoverClick"
    >
      <Home class="w-5 h-5" />
      <span class="menuButton">{{ $t("discover") }}</span>
    </v-btn>

    <ActivePlayerPopover auto-show align="end" @click="handlePlayersClick">
      <template #trigger="{ onClick }">
        <v-btn
          :aria-label="$t('players')"
          tabindex="0"
          variant="text"
          @click="onClick"
        >
          <Speaker class="w-5 h-5" />
          <span class="menuButton">{{ $t("players") }}</span>
        </v-btn>
      </template>
      </ActivePlayerPopover>

      <v-list>
        <v-list-item
          v-for="menuItem of menuItems.filter((x) => x.isLibraryNode && !x.hidden)"
          :key="menuItem.label"
          :title="$t(menuItem.label)"
          :to="menuItem.path"
        >
          <template #prepend>
            <component :is="menuItem.icon" class="w-5 h-5 mr-3" />
          </template>
        </v-list-item>
      </v-list>
    </v-menu>
  </v-bottom-navigation>
</template>

<script setup lang="ts">
import { eventbus } from "@/plugins/eventbus";
import { store } from "@/plugins/store";
import { Home, Menu, Speaker } from "lucide-vue-next";
import { computed, useRouter } from "vue-router";
import ActivePlayerPopover from "@/components/ActivePlayerPopover.vue";

const router = useRouter();
export interface Props {
  height: number;
}
defineProps<Props>();

const handleMenuClick = computed(() => () => {
  eventbus.emit("mobile-sidebar-open");
});

const menuItems = computed(() => getMenuItems());

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
