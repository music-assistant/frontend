<template>
  <div :style="`width: ${width}px; height: 30px;`">
    <v-btn
      variant="tonal"
      :style="`
            width: ${width}px;
            position: absolute;
            border: 1px solid #cccccc4d;
            height: 38px;
            margin-top: -1px;
            margin-left: -1px;
          `"
      :disabled="loading"
      @click="emit('menu')"
    >
      <v-icon
        icon="mdi-menu-down"
        size="xx-large"
        :style="`width: 20px; margin-left: ${width - 42}px`"
      />
    </v-btn>

    <v-btn
      color="primary"
      flat
      :disabled="disabled || loading"
      :style="`width: ${width - 40}px; justify-content: left;`"
      :text="text"
      @click="emit('click')"
    >
      <template v-if="(icon && text!.length < 12) || loading" #prepend>
        <v-progress-circular
          v-if="loading"
          color="grey-lighten-5"
          indeterminate
        />
        <v-icon v-else :icon="icon" size="x-large" />
      </template>
    </v-btn>
  </div>
</template>

<script setup lang="ts">
// properties
export interface Props {
  icon?: string;
  text?: string;
  disabled?: boolean;
  width?: number;
  loading?: boolean;
}
withDefaults(defineProps<Props>(), {
  icon: undefined,
  text: undefined,
  disabled: false,
  width: 200,
  loading: true,
});

// emitters
const emit = defineEmits<{
  (e: "click"): void;
  (e: "menu"): void;
}>();
</script>
