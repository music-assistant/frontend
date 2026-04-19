<template>
  <div class="tokens-badge">
    <div class="badge-left" :style="leftStyle">
      <component :is="iconComponent" :size="14" />
      <span class="badge-count">{{ tokens }}/{{ maxTokens }}</span>
    </div>
    <div class="badge-right" :style="rightStyle">
      <span class="badge-label">{{ label }}</span>
      <span v-if="countdown" class="badge-countdown">
        <Clock :size="11" />
        {{ countdown }}
      </span>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed } from "vue";
import Color from "color";
import { Clock, ListPlus, Rocket } from "lucide-vue-next";

const props = defineProps<{
  tokens: number;
  maxTokens: number;
  countdown: string;
  label: string;
  color: string;
  icon: "boost" | "request";
}>();

const iconComponent = computed(() =>
  props.icon === "request" ? ListPlus : Rocket,
);

const leftStyle = computed(() => {
  try {
    const c = Color(props.color);
    return {
      background: c.alpha(0.85).string(),
      color: c.isLight() ? "#000" : "#fff",
    };
  } catch {
    return {};
  }
});

const rightStyle = computed(() => {
  try {
    const c = Color(props.color);
    return {
      background: c.alpha(0.12).string(),
      borderColor: c.alpha(0.3).string(),
      color: c.string(),
    };
  } catch {
    return {};
  }
});
</script>

<style scoped>
.tokens-badge {
  display: inline-flex;
  align-items: stretch;
  border-radius: 10px;
  overflow: hidden;
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-left {
  display: flex;
  align-items: center;
  gap: 0.3rem;
  padding: 0.45rem 0.65rem;
}

.badge-count {
  font-weight: 700;
  font-size: 0.85rem;
}

.badge-right {
  display: flex;
  align-items: center;
  gap: 0.4rem;
  padding: 0.45rem 0.75rem;
  border: 1px solid;
  border-left: none;
  border-radius: 0 10px 10px 0;
}

.badge-label {
  font-size: 0.8rem;
  font-weight: 600;
}

.badge-countdown {
  display: flex;
  align-items: center;
  gap: 0.2rem;
  font-size: 0.72rem;
  padding-left: 0.35rem;
  border-left: 1px solid currentColor;
  opacity: 0.7;
}

@media (max-width: 768px) {
  .badge-label {
    display: none;
  }

  .badge-right {
    padding: 0.45rem 0.55rem;
  }
}
</style>
