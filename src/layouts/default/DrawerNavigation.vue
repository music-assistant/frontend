<template>
  <v-navigation-drawer v-if="getBreakpointValue({ breakpoint: 'bp3' })" ref="resizeComponent" app
    :permanent="!$vuetify.display.mobile" :rail="!$vuetify.display.mobile && !store.showNavigationMenu"
    :model-value="($vuetify.display.mobile && store.showNavigationMenu) || !$vuetify.display.mobile"
    :width="!getBreakpointValue('mobile') ? 200 : 250" @update:model-value="(e) => {
      if ($vuetify.display.mobile) store.showNavigationMenu = e;
    }
      ">

    <v-list-item dark style="height: 52px;" :active="false">
      <template #prepend v-if="showLogo">
        <img class="logo_icon" :style="$vuetify.theme.current.dark ? 'filter: invert(100%);' : ''" width="35"
          src="@/assets/logo.svg" />
      </template>
      <template #title v-if="showLogo">
        <div class="logo_text">Music
          Assistant</div>
      </template>
    </v-list-item>
    <!-- back button -->
    <!-- NOTE: we only allow/show the back button at one of the nested levels (item details) -->
    <Button v-if="showBackButton" :height="15" :width="40" style="position: absolute; right: 4px;top: 14px;"
      @click.stop="backButton" icon="mdi-arrow-left" :title="$t('tooltip.back')" />
    <v-divider />

    <!-- menu items -->
    <v-list lines="one" density="compact" nav>
      <v-list-item v-for="menuItem of menuItems" :key="menuItem.path" nav density="compact" :height="15"
        :title="$t(menuItem.label)" :prepend-icon="menuItem.icon" :to="menuItem.path" />
    </v-list>
    <!-- button at bottom to collapse/expand the navigation drawer-->
    <Button nav :height="15" :width="40" style="position: absolute; right: 10px;bottom: 20px;" :ripple="false"
      :icon="store.showNavigationMenu ? 'mdi-chevron-left' : 'mdi-chevron-right'" :title="$t('tooltip.show_menu')"
      @click.stop="store.showNavigationMenu = !store.showNavigationMenu" />
  </v-navigation-drawer>
</template>

<script setup lang="ts">
import { getBreakpointValue } from '@/plugins/breakpoint';
import { store } from '@/plugins/store';
import { computed, watch } from 'vue';
import Button from '@/components/mods/Button.vue';
import router from '@/plugins/router';

const backButtonAllowedRouteNames = ["track", "artist", "album", "playlist", "radio", "addprovider", "editprovider", "editplayer", "editcore"]

const menuItems = [
  // disable Home until we have something useful to fill that screen
  // {
  //   label: 'home',
  //   icon: 'mdi-home-outline',
  //   path: '/home',
  // },
  {
    label: 'artists',
    icon: 'mdi-account-outline',
    path: '/artists',
  },
  {
    label: 'albums',
    icon: 'mdi-album',
    path: '/albums',
  },
  {
    label: 'tracks',
    icon: 'mdi-music-note',
    path: '/tracks',
  },
  {
    label: 'playlists',
    icon: 'mdi-playlist-play',
    path: '/playlists',
  },
  {
    label: 'radios',
    icon: 'mdi-access-point',
    path: '/radios',
  },
  {
    label: 'browse',
    icon: 'mdi-folder-outline',
    path: '/browse',
  },
  {
    label: 'search',
    icon: 'mdi-magnify',
    path: '/search',
  },
  {
    label: 'settings.settings',
    icon: 'mdi-cog-outline',
    path: '/settings',
  },
];

const showBackButton = computed(() => {
  return store.prevRoutes.length > 0 && backButtonAllowedRouteNames.includes(router.currentRoute.value.name!.toString())
});
const showLogo = computed(() => {
  return !(showBackButton.value && !store.showNavigationMenu);
});

watch(
  () => store.showNavigationMenu,
  (isShown) => {
    isShown ? (store.sizeNavigationMenu = !getBreakpointValue('mobile') ? 200 : 250) : (store.sizeNavigationMenu = 55);
  },
);

const backButton = function () {
  const prevRoute = store.prevRoutes.pop();
  if (prevRoute) {
    prevRoute.params['backnav'] = 'true';
    router.replace(prevRoute).then(() => {
      setTimeout(() => {
        window.scrollTo(0, prevRoute.meta.scrollPos || 0);
      }, 400);
    });
  }
};
</script>

<style>
.logo_text {
  margin-left: 10px;
  font-family: 'JetBrains Mono Medium';
  font-size: 55;
  font-weight: 500
}

.logo_icon {
  margin-left: -5px;
  border-radius: 4px;
}
</style>