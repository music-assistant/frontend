<template>
  <!-- active queue -->
  <Button
    variant="icon"
    icon="mdi-playlist-play"
    :color="props.color ? color : ''"
    @click="
      store.showFullscreenPlayer = false;
      router.push('/playerqueue/');
    "
  />
</template>

<script setup lang="ts">
import { store } from '@/plugins/store';
import router from '@/plugins/router';
import Button from '@/components/mods/Button.vue';

// properties
export interface Props {
  color?: string;
}
const props = defineProps<Props>();
</script>
