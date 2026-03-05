<template>
  <div class="tokens-badge" :style="badgeStyle">
    <v-icon size="small" :color="color">{{ icon }}</v-icon>
    <span class="token-count" :style="{ color }">
      {{ tokens }}/{{ maxTokens }}
    </span>
    <span class="token-label">{{ label }}</span>
    <span v-if="countdown" class="token-countdown" :style="{ color }">
      <v-icon size="x-small">mdi-clock-outline</v-icon>
      {{ countdown }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Color from "color";

const props = defineProps<{
  tokens: number;
  maxTokens: number;
  countdown: string;
  label: string;
  color: string;
  icon: string;
}>();

const badgeStyle = computed(() => {
  try {
    const c = Color(props.color);
    return {
      background: c.alpha(0.1).string(),
      borderColor: c.alpha(0.3).string(),
    };
  } catch {
    return {};
  }
});
</script>

<style scoped>
.tokens-badge {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  padding: 0.5rem 1rem;
  border-radius: 20px;
  border: 1px solid;
}

.token-count {
  font-weight: 700;
  font-size: 1rem;
}

.token-label {
  font-size: 0.875rem;
  opacity: 0.8;
}

.token-countdown {
  display: flex;
  align-items: center;
  gap: 0.25rem;
  font-size: 0.875rem;
  font-weight: 600;
  padding-left: 0.5rem;
  border-left: 1px solid rgba(var(--v-theme-on-surface), 0.2);
}

@media (max-width: 768px) {
  .tokens-badge {
    padding: 0.375rem 0.75rem;
    font-size: 0.875rem;
  }

  .token-label {
    display: none;
  }

  .token-countdown {
    padding-left: 0.375rem;
    border-left: none;
  }
}
</style>
