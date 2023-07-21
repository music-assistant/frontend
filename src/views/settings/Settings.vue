<template>
  <div>
    <v-toolbar variant="flat" color="transparent" style="height: 50px">
      <template #title> {{ $t('settings.settings') }} | {{ $t(`settings.${activeTab}`) }} </template>
      <template #append>
        <v-tabs :model-value="activeTab" align-tabs="end">
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
      </template>
    </v-toolbar>
    <router-view v-slot="{ Component }" app>
      <component :is="Component" />
      <!-- transition temporary disabled as it renders the view unusable somehow? -->
      <!-- <transition name="fade" mode="out-in">
        <component :is="Component" />
      </transition> -->
    </router-view>
  </div>
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
