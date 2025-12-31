<template>
  <div class="qr-container">
    <div v-if="loading" class="qr-loading">
      <v-progress-circular indeterminate />
    </div>
    <div v-else-if="qrCodeUrl" class="qr-display">
      <a
        :href="qrCodeUrl"
        target="_blank"
        rel="noopener noreferrer"
        class="qr-link"
      >
        <canvas ref="qrCanvas"></canvas>
      </a>
      <p class="qr-instructions">Scan to join the party!</p>
    </div>
    <div v-else class="qr-disabled">
      <v-icon size="64" icon="mdi-qrcode-off" />
      <p>Party Mode Disabled</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, watch, nextTick } from "vue";
import QRCode from "qrcode";
import api from "@/plugins/api";
import { store } from "@/plugins/store";

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrCodeUrl = ref<string>("");
const loading = ref(true);

const generateQRCode = async () => {
  loading.value = true;
  try {
    // Always fetch party mode enabled setting to ensure we have latest value
    const partyModeEnabled = await api.getCoreConfigValue(
      "webserver",
      "party_mode_enabled",
    );
    store.partyModeEnabled = !!partyModeEnabled;

    // Fetch guest URL from backend (will return empty string if disabled)
    const url = (await api.sendCommand("webserver/party_mode_url")) as string;

    if (url) {
      qrCodeUrl.value = url;

      // Wait for DOM to be ready
      await nextTick();

      // Generate QR code on canvas with MA brand blue and transparent background
      if (qrCanvas.value) {
        await QRCode.toCanvas(qrCanvas.value, url, {
          width: 220,
          margin: 3,
          color: {
            dark: "#03a9f4", // Music Assistant brand blue
            light: "#00000000", // Transparent background
          },
        });
      }
    } else {
      qrCodeUrl.value = "";
    }
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    qrCodeUrl.value = "";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await generateQRCode();
});

// Regenerate if party mode setting changes
watch(
  () => store.partyModeEnabled,
  () => {
    generateQRCode();
  },
);
</script>

<style scoped>
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 250px;
}

.qr-display {
  text-align: center;
  padding: 1.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: 16px;
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.qr-link {
  display: block;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.qr-link:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.qr-display canvas {
  display: block;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.qr-instructions {
  margin-top: 1rem;
  font-size: 0.875rem;
  color: rgba(255, 255, 255, 0.8);
  font-weight: 500;
  letter-spacing: 0.02em;
}

.qr-disabled {
  text-align: center;
  opacity: 0.5;
}

.qr-disabled p {
  margin-top: 0.5rem;
  color: rgba(255, 255, 255, 0.5);
}
</style>
