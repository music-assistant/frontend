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
import { useIsDark } from "@/composables/useIsDark";

const props = withDefaults(
  defineProps<ContainerProps>(),
  defaultContainerProps,
);

defineEmits<ContainerEmits>();

const { isDark } = useIsDark();

const { containerProps, containerClasses } = useContainer(props, isDark.value);
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

.container-panel--light {
  background: #f5f5f5;
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
