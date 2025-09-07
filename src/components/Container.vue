<template>
  <v-container v-bind="containerProps" :class="containerClasses">
    <template v-for="(_, name) in $slots" #[name]>
      <slot :name="name"></slot>
    </template>
  </v-container>
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
import { computed } from "vue";
import { useTheme } from "vuetify";

const props = withDefaults(
  defineProps<ContainerProps>(),
  defaultContainerProps,
);

defineEmits<ContainerEmits>();

const theme = useTheme();
const isDark = computed(() => theme.current.value.dark);

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
