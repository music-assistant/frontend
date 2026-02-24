<template>
  <div class="config-panel-content">
    <p class="text-body-2 text-medium-emphasis mb-4">
      {{ description }}
    </p>
    <v-btn
      variant="outlined"
      :color="destructive ? 'error' : 'primary'"
      :prepend-icon="icon"
      :loading="loading"
      :disabled="loading"
      @click="$emit('restore')"
    >
      {{ buttonText }}
    </v-btn>
  </div>
</template>

<script setup lang="ts">
interface Props {
  description: string;
  buttonText: string;
  loading: boolean;
  icon: string;
  destructive?: boolean;
}

defineProps<Props>();
defineEmits<{ restore: [] }>();
</script>

<style scoped>
.config-panel-content {
  padding: 16px 20px 20px;
  border-top: 1px solid rgba(var(--v-theme-on-surface), 0.08);
}
</style>
