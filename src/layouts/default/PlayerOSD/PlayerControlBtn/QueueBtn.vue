<template>
  <!-- active queue -->
  <Button
    variant="icon"
    icon="mdi-playlist-play"
    @click="
      store.showFullscreenPlayer = false;
      router.push('/playerqueue/');
    "
  />
</template>

<script setup lang="ts">
import { computed } from 'vue';

import api from '@/plugins/api';
import { store } from '@/plugins/store';
import router from '@/plugins/router';
import Button from '@/components/mods/Button.vue';
</script>
