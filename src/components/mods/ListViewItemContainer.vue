<template>
  <div v-if="slots.default" style="margin: 10px 0px 10px 0px">
    <v-toolbar color="transparent" density="compact" style="padding: 10px 0px">
      <template #prepend> <slot name="prepend"></slot></template>

      <template #title>
        <h2 class="line-clamp-1"><slot name="title"></slot></h2>
      </template>

      <template #append> <slot name="append"></slot></template>
    </v-toolbar>
    <v-divider />

    <slot></slot>
  </div>
</template>

<script setup lang="ts">
import { useSlots } from 'vue';
import Container from '@/components/mods/Container.vue';
const slots = useSlots();
</script>
