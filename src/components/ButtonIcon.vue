<template>
  <v-btn class="icon-btn" :ripple="false" icon variant="plain">
    <template v-if="$slots.default" #default>
      <slot></slot>
    </template>
    <template v-if="$slots.prepend" #prepend>
      <slot name="prepend"></slot>
    </template>
    <template v-if="$slots.append" #append>
      <slot name="append"></slot>
    </template>
    <template v-if="$slots.loader" #loader>
      <slot name="loader"></slot>
    </template>
  </v-btn>
</template>

<script setup lang="ts">
// properties
/*
export interface Props {
  type: 'onlyIcon' | 'button' | 'text';
}
const props = withDefaults(defineProps<Props>(), {
  type: 'onlyIcon',
});*/
</script>

<style>
.icon-btn {
  width: calc(var(--v-btn-height) + 10px) !important;
  height: calc(var(--v-btn-height) + 10px) !important;
}
</style>
