<template>
  <section>
    <v-tabs hide-slider :model-value="activeTab" align-tabs="end">
      <v-tab value="providers" :to="{ name: 'providersettings' }">
        {{ $t('settings.providers') }}
      </v-tab>
      <v-tab value="players" :to="{ name: 'playersettings' }">
        {{ $t('settings.players') }}
      </v-tab>
      <v-tab value="core" :to="{ name: 'coresettings' }">
        {{ $t('settings.core') }}
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
import { computed } from 'vue';
import { useRouter } from 'vue-router';

// global refs
const router = useRouter();

// computed properties
const activeTab = computed(() => {
  if (router.currentRoute.value.name?.toString().includes('player')) {
    return 'players';
  }
  if (router.currentRoute.value.name?.toString().includes('core')) {
    return 'core';
  }
  return 'providers';
});
</script>
