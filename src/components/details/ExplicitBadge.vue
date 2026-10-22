<template>
  <span
    class="explicit-badge"
    :class="{ 'explicit-badge--overlay': overlay }"
    role="img"
    :title="$t('tooltip.explicit')"
    :aria-label="$t('tooltip.explicit')"
    >E</span
  >
</template>

<script setup lang="ts">
import { $t } from "@/plugins/i18n";

export interface Props {
  // white-on-dark styling for use over artwork; otherwise theme-aware
  overlay?: boolean;
}
withDefaults(defineProps<Props>(), { overlay: false });
</script>

<style scoped>
.explicit-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 16px;
  height: 16px;
  border-radius: 3px;
  font-size: 11px;
  font-weight: 700;
  line-height: 1;
  background: rgba(var(--v-theme-on-surface), 0.12);
  color: rgba(var(--v-theme-on-surface), 0.7);
}
.explicit-badge--overlay {
  background: rgba(0, 0, 0, 0.55);
  color: #fff;
}
</style>
