<template>
  <div class="screensaver" @click="$emit('wake')">
    <div class="screensaver-content">
      <div class="screensaver-logo-wrapper">
        <v-icon
          size="128"
          icon="mdi-music-circle"
          class="screensaver-logo"
        />
      </div>
      <h1 class="screensaver-title">Music Assistant</h1>
      <p v-if="message" class="screensaver-message">{{ message }}</p>
      <p class="screensaver-hint">Touch to wake</p>
    </div>
  </div>
</template>

<script setup lang="ts">
export interface Props {
  message?: string;
}

withDefaults(defineProps<Props>(), {
  message: "Queue is empty",
});

defineEmits<{
  wake: [];
}>();
</script>

<style scoped>
.screensaver {
  position: absolute;
  top: 0;
  left: 0;
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.95);
  z-index: 1000;
  cursor: pointer;
  animation: fadeIn 1s ease-in-out;
}

.screensaver-content {
  text-align: center;
  animation: pulse 3s ease-in-out infinite;
  user-select: none;
}

.screensaver-logo-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 2rem;
}

.screensaver-logo {
  opacity: 0.8;
}

.screensaver-title {
  font-size: 3rem;
  font-weight: 300;
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.screensaver-message {
  font-size: 1.5rem;
  margin-bottom: 2rem;
  color: rgba(255, 255, 255, 0.7);
}

.screensaver-hint {
  font-size: 1rem;
  color: rgba(255, 255, 255, 0.5);
  font-style: italic;
}

@keyframes pulse {
  0%,
  100% {
    opacity: 0.6;
  }
  50% {
    opacity: 1;
  }
}

@keyframes fadeIn {
  from {
    opacity: 0;
  }
  to {
    opacity: 1;
  }
}
</style>
