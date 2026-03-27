<template>
  <div v-bind="containerProps" :class="containerClasses">
    <slot></slot>
  </div>
</template>

<script lang="ts">
export type {
  ContainerEmits,
  ContainerProps,
} from "@/composables/useContainer";
</script>

<script setup lang="ts">
import {
  defaultContainerProps,
  useContainer,
  type ContainerEmits,
  type ContainerProps,
} from "@/composables/useContainer";

const props = withDefaults(
  defineProps<ContainerProps>(),
  defaultContainerProps,
);

defineEmits<ContainerEmits>();

const { containerProps, containerClasses } = useContainer(props);
</script>

<style scoped>
.container-default {
  padding: 10px;
}

.container-compact {
  padding: 5px;
}

.container-comfortable {
  padding: 20px;
}

.container-panel {
  padding: 10px;
}

.container-panel {
  background: var(--card);
}

@media (min-width: 1920px) {
  .container-main {
    max-width: unset !important;
  }
}

@media (min-width: 1280px) {
  .container-main {
    max-width: unset !important;
  }
}

@media (min-width: 960px) {
  .container-main {
    max-width: unset !important;
  }
}
</style>
