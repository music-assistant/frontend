<template>
  <span
    class="explicit-badge inline-flex size-4 items-center justify-center [text-shadow:none]"
    :class="{ 'explicit-badge--overlay': overlay }"
    role="img"
    :title="$t('tooltip.explicit')"
    :aria-label="$t('tooltip.explicit')"
  >
    <!-- Crop the SVG padding so both the painted badge and its layout stay 16px. -->
    <ExplicitIcon class="size-4 shrink-0" viewBox="2 2 20 20" />
  </span>
</template>

<script setup lang="ts">
import ExplicitIcon from "@/components/icons/ExplicitIcon.vue";
import { $t } from "@/plugins/i18n";

export interface Props {
  // white-on-dark styling for use over artwork; otherwise theme-aware
  overlay?: boolean;
}
withDefaults(defineProps<Props>(), { overlay: false });
</script>

<style scoped>
.explicit-badge {
  --explicit-icon-square: rgba(var(--v-theme-on-surface), 0.12);
  --explicit-icon-letter: rgba(var(--v-theme-on-surface), 0.7);
}
.explicit-badge--overlay {
  --explicit-icon-square: rgba(0, 0, 0, 0.55);
  --explicit-icon-letter: #fff;
}
</style>
