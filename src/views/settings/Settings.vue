<template>
  <div>
    <v-toolbar color="transparent" :title="getBreakpointValue('bp4') ? $t('settings.settings') : ''">
      <template #append>
        <v-tabs :model-value="activeTab" align-tabs="end" height="100%">
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
    <v-divider />
    <!-- some spacing -->
    <div style="height: 15px"></div>
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
import { getBreakpointValue } from '@/plugins/breakpoint';

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
