<template>
  <v-main id="cont" class="overflow-y-auto" style="height: 0px">
    <drawer-navigation />
    <add-to-playlist-dialog />
    <play-item-dialog />
    <router-view v-slot="{ Component }" app>
      <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition>
    </router-view>
  </v-main>
</template>

<script lang="ts" setup>
import DrawerNavigation from './DrawerNavigation.vue';
import AddToPlaylistDialog from './AddToPlaylistDialog.vue';
import PlayItemDialog from './PlayItemDialog.vue';
</script>
