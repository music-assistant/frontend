<template>
  <router-view />
</template>

<script setup lang="ts">
import { api } from './plugins/api';
import { onMounted } from 'vue';


onMounted(() => {
  // Initialize API Connection
  // TODO: retrieve serveraddress through discovery and/or user settings ?
  let serverAddress = ''
  if (process.env.NODE_ENV === 'production') {
    const loc = window.location
    serverAddress = loc.origin + loc.pathname
  } else {
    serverAddress = 'http://192.168.1.170:8095/'
  }
  api.initialize(serverAddress);
})

</script>

<style>

</style>
