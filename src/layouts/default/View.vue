<template>
  <v-main id="cont" class="overflow-y-auto" style="height: 0px">
    <drawer-navigation v-if="store.navigationMenuStyle == 'vertical'" />

    <router-view v-slot="{ Component }" app>
      <transition name="fade" mode="out-in">
        <keep-alive
          :include="['artists', 'albums', 'tracks', 'playlists', 'browse']"
        >
          <component :is="Component" />
        </keep-alive>
      </transition>
    </router-view>
    <add-to-playlist-dialog />
    <item-context-menu />
  </v-main>
</template>

<script lang="ts" setup>
import DrawerNavigation from './DrawerNavigation.vue';
import AddToPlaylistDialog from './AddToPlaylistDialog.vue';
import ItemContextMenu from './ItemContextMenu.vue';
import { store } from '@/plugins/store';
</script>
