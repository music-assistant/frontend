<template>
  <section>
    <v-tabs
      show-arrows
      grow
      hide-slider
      style="margin-top: 8px"
     :model-value="activeTab"
    >
      <v-tab value="musicproviders" :to="{name: 'musicprovidersettings'}">
        {{ $t("settings.musicproviders") }}
      </v-tab>
      <v-tab value="players" :to="{name: 'playersettings'}">
        {{ $t("settings.players") }}
      </v-tab>
    </v-tabs>
    <v-divider />
      <router-view v-slot="{ Component }" app>
        <transition name="fade" mode="out-in">
          <component :is="Component" />
        </transition>
      </router-view>
  </section>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { useRouter } from "vue-router";

// global refs
const router = useRouter();

// computed properties
const activeTab = computed(() => {
  if (router.currentRoute.value.name?.toString().includes('player')) {
    return "players"
  }
  return "musicproviders";
});

</script>
