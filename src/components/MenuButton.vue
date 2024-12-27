<template>
  <div :style="`width: ${width}px; height: 30px;`">
    <v-menu
      v-model="showMenu"
      :close-on-content-click="true"
      :nudge-width="200"
      offset-x
      scrim="!store.showPlayersMenu"
      z-index="100"
    >
      <template #activator="{ props }">
        <v-btn
          variant="tonal"
          v-bind="props"
          :style="`
            width: ${width}px;
            position: absolute;
            border: 1px solid #cccccc4d;
            height: 38px;
            margin-top: -1px;
            margin-left: -1px;
          `"
        >
          <v-icon
            icon="mdi-menu-down"
            size="xx-large"
            :style="`width: 20px; margin-left: ${width - 42}px`"
          />
        </v-btn>
      </template>

      <slot name="menu"></slot>
    </v-menu>
    <v-btn
      color="primary"
      flat
      :disabled="disabled"
      :style="`width: ${width - 40}px; justify-content: left;`"
      :text="text"
      @click="openMenuOnClick ? (showMenu = !showMenu) : emit('click')"
    >
      <template v-if="icon && text!.length < 12" #prepend>
        <v-icon :icon="icon" size="x-large" />
      </template>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
import { ref } from "vue";
import { store } from "@/plugins/store";

// properties
export interface Props {
  icon?: string;
  text?: string;
  disabled?: boolean;
  width?: number;
  openMenuOnClick?: boolean;
}
withDefaults(defineProps<Props>(), {
  icon: undefined,
  text: undefined,
  disabled: false,
  width: 200,
  openMenuOnClick: false,
});

const showMenu = ref(false);

// emitters
const emit = defineEmits<{
  (e: "click"): void;
}>();
</script>
