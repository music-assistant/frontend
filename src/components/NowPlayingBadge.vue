<template>
  <!-- Now playing badge -->
  <span
    :style="badgeStyle"
    class="now-playing-badge"
    aria-label="Now playing"
    v-if="showBadge">
    Now playing
  </span>
  <!-- Now playing icon -->
  <div
    :style="iconStyle"
    class="now-playing-icon"
    v-if="showIcon">
    <div class="bar"></div>
    <div class="bar"></div>
    <div class="bar"></div>
    <div class="bar"></div>
  </div>
</template>

<script setup lang="ts">
import { CSSProperties } from 'vue';

// properties
export interface Props {
  showBadge?: boolean;
  showIcon?: boolean;
  badgeStyle?: string | CSSProperties | Array<string | CSSProperties>;
  iconStyle?: string | CSSProperties | Array<string | CSSProperties>;
}

const props = withDefaults(
  defineProps<Props>(),
  {
    showBadge: true,
    showIcon: true,
    badgeStyle: '',
    iconStyle: ''
  }
)
</script>

<style>
.now-playing-badge {
  background: rgb(var(--v-theme-primary));
  color: #fff;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 0.55rem;
  text-transform: uppercase;
  letter-spacing: 0.5px;
}

.is-playing {
  font-weight: 600;
}

.now-playing-icon {
  display: flex;
  gap: 2px;
  margin-left: 6px;
  margin-right: 6px;
  align-items: flex-end;
  height: 16px;
}
.now-playing-icon .bar {
  width: 3px;
  background: rgb(var(--v-theme-primary));
  animation: eq 1s infinite ease-in-out;
}
.now-playing-icon .bar:nth-child(1) {
  animation-delay: 0s;
}
.now-playing-icon .bar:nth-child(2) {
  animation-delay: 0.2s;
}
.now-playing-icon .bar:nth-child(3) {
  animation-delay: 0.4s;
}
.now-playing-icon .bar:nth-child(4) {
  animation-delay: 0.6s;
}

@keyframes eq {
  0%,
  100% {
    height: 4px;
  }
  50% {
    height: 16px;
  }
}
</style>