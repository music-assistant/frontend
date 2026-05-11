<template>
  <div class="filter-banner">
    <span class="filter-banner-text">
      <i18n-t
        :keypath="
          performerName
            ? 'classical_filter_showing_by'
            : 'classical_filter_showing'
        "
        tag="span"
      >
        <template #count>
          <strong>{{ count }}</strong>
        </template>
        <template #noun>
          {{
            count === 1
              ? $t("classical_recording")
              : $t("classical_recordings_lower")
          }}
        </template>
        <template v-if="performerName" #performer>
          <strong>{{ performerName }}</strong>
        </template>
      </i18n-t>
    </span>
    <button type="button" class="filter-banner-clear" @click="$emit('clear')">
      {{ $t("classical_filter_show_all") }}
    </button>
  </div>
</template>

<script setup lang="ts">
defineOptions({ name: "ContextualFilterBanner" });

defineProps<{
  count: number;
  performerName?: string;
}>();

defineEmits<{
  (e: "clear"): void;
}>();
</script>

<style scoped>
.filter-banner {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  padding: 0.6rem 0.9rem;
  border-radius: 8px;
  background: var(--muted, rgba(255, 255, 255, 0.05));
  border: 1px solid var(--border, #2a2a2a);
  font-size: 0.9rem;
}

.filter-banner-text {
  flex: 1;
  min-width: 0;
}

.filter-banner-clear {
  background: transparent;
  border: 1px solid var(--border, #444);
  border-radius: 6px;
  padding: 0.3rem 0.7rem;
  font: inherit;
  color: inherit;
  cursor: pointer;
}

.filter-banner-clear:hover {
  background: var(--accent, rgba(255, 255, 255, 0.08));
}
</style>
