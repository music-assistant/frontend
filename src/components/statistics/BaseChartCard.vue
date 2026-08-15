<template>
  <div class="chart-card">
    <div class="chart-card__header">
      <h3 class="chart-card__title">{{ title }}</h3>
    </div>
    <div v-if="loading" class="chart-card__loading">
      <v-progress-circular indeterminate size="32" />
    </div>
    <div v-else-if="isEmpty" class="chart-card__empty">
      {{ emptyMessage || $t("no_data") }}
    </div>
    <div v-else class="chart-card__content" :class="{ clickable: clickable }">
      <slot></slot>
    </div>
  </div>
</template>

<script setup lang="ts">
interface Props {
  title: string;
  loading?: boolean;
  isEmpty?: boolean;
  emptyMessage?: string;
  clickable?: boolean;
}

withDefaults(defineProps<Props>(), {
  loading: false,
  isEmpty: false,
  emptyMessage: "",
  clickable: false,
});
</script>

<style scoped>
.chart-card {
  background: rgb(var(--v-theme-surface));
  border-radius: 16px;
  padding: 24px;
  height: 320px;
  display: flex;
  flex-direction: column;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.08);
  transition: box-shadow 0.2s;
}

.chart-card:hover {
  box-shadow: 0 8px 24px rgba(0, 0, 0, 0.12);
}

.chart-card__header {
  margin-bottom: 16px;
}

.chart-card__title {
  font-size: 16px;
  font-weight: 700;
  color: rgb(var(--v-theme-on-surface));
  margin: 0;
  letter-spacing: -0.3px;
}

.chart-card__loading,
.chart-card__empty {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  color: rgb(var(--v-theme-on-surface));
  opacity: 0.5;
}

.chart-card__content {
  flex: 1;
  display: flex;
  align-items: center;
  justify-content: center;
  min-height: 0;
}

.chart-card__content.clickable :deep(canvas) {
  cursor: pointer;
}
</style>
