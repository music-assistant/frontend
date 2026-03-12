<template>
  <div class="tokens-badge" :style="badgeStyle">
    <component :is="iconComponent" :size="16" :color="color" />
    <span class="token-count" :style="{ color }">
      {{ tokens }}/{{ maxTokens }}
    </span>
    <span class="token-label" :style="{ color }">{{ label }}</span>
    <span v-if="countdown" class="token-countdown" :style="{ color }">
      <Clock :size="12" :color="color" />
      {{ countdown }}
    </span>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import { match } from "ts-pattern";
import Color from "color";
import { Clock, ListPlus, Rocket } from "lucide-vue-next";

const props = defineProps<{
  tokens: number;
  maxTokens: number;
  countdown: string;
  label: string;
  color: string;
  icon: string;
}>();

const iconComponent = computed(() =>
  match(props.icon)
    .with("mdi-rocket-launch", () => Rocket)
    .with("mdi-playlist-plus", () => ListPlus)
    .otherwise(() => Rocket),
);

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
  font-weight: 700;
  font-size: 1rem;
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
