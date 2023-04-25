<template>
  <v-main id="cont">
    <navigation-menu />
    <app-bar />
    <v-container fluid style="padding-left: 0; padding-right: 0">
      <router-view v-slot="{ Component }" app>
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
      <!-- white space to reserve space for footer -->
      <!-- <div style="height: 150px" /> -->
    </v-container>
  </v-main>
</template>

<script lang="ts" setup>
import NavigationMenu from './NavigationMenu.vue';
import AppBar from './AppBar.vue';
</script>
