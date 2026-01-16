<template>
  <div ref="qrContainer" class="qr-container">
    <div v-if="loading" class="qr-loading">
      <v-progress-circular indeterminate />
    </div>
    <div v-else-if="!guestAccessEnabled" class="qr-disabled">
      <v-icon size="64" icon="mdi-qrcode-off" />
      <p>Guest Access Disabled</p>
      <p class="qr-hint">Enable in party mode plugin settings</p>
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
      <p class="qr-instructions text-h4">Scan to join the party!</p>
    </div>
    <div v-else class="qr-error">
      <v-icon size="64" icon="mdi-alert-circle-outline" />
      <p>Failed to generate QR code</p>
      <p class="qr-hint">Check your network settings</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref, onMounted, onUnmounted, nextTick } from "vue";
import QRCode from "qrcode";
import api from "@/plugins/api";
import { EventType, RemoteAccessInfo } from "@/plugins/api/interfaces";

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrContainer = ref<HTMLElement | null>(null);
const qrCodeUrl = ref<string>("");
const guestAccessEnabled = ref<boolean>(false);
const loading = ref(true);
const qrSize = ref(320);
const lastRemoteAccessEnabled = ref<boolean | null>(null);
let unsubscribe: (() => void) | null = null;
let resizeObserver: ResizeObserver | null = null;
let remoteAccessPollInterval: ReturnType<typeof setInterval> | null = null;

const calculateQRSize = () => {
  if (!qrContainer.value) return 320;
  const containerWidth = qrContainer.value.clientWidth;
  const containerHeight = qrContainer.value.clientHeight;
  // Use the smaller dimension, leave room for padding and instructions
  const availableSize = Math.min(containerWidth, containerHeight) - 120;
  // Clamp between 160 and 512 for usability
  return Math.max(160, Math.min(512, availableSize));
};

const checkRemoteAccessStatus = async () => {
  try {
    const info = (await api.sendCommand(
      "remote_access/info",
    )) as RemoteAccessInfo;
    const currentEnabled = info.enabled;

    // If remote access status changed, regenerate QR code
    if (
      lastRemoteAccessEnabled.value !== null &&
      lastRemoteAccessEnabled.value !== currentEnabled
    ) {
      await generateQRCode();
    }
    lastRemoteAccessEnabled.value = currentEnabled;
  } catch {
    // Ignore errors - remote_access/info may not be available
  }
};

const generateQRCode = async () => {
  loading.value = true;
  try {
    // Fetch guest URL from backend (returns {url, code, expires_at} or empty values if disabled)
    const result = (await api.sendCommand("party_mode/url")) as {
      url: string;
      code: string;
      expires_at: string | null;
    };

    // Update guest access enabled state based on whether we got a URL
    // Ensure url is a string before calling .trim()
    const url = typeof result?.url === "string" ? result.url : "";
    guestAccessEnabled.value = !!(url && url.trim() !== "");

    // Always update qrCodeUrl to ensure UI reflects backend state
    if (!guestAccessEnabled.value) {
      qrCodeUrl.value = "";
      return;
    }

    // Set URL to trigger display
    qrCodeUrl.value = url;

    // Wait for DOM to be ready - need multiple ticks to ensure canvas is mounted
    await nextTick();
    await nextTick();

    // Generate QR code on canvas with MA brand blue and transparent background
    qrSize.value = calculateQRSize();
    if (qrCanvas.value) {
      await QRCode.toCanvas(qrCanvas.value, url, {
        width: qrSize.value,
        margin: 2,
        color: {
          dark: "#03a9f4", // Music Assistant brand blue
          light: "#00000000", // Transparent background
        },
      });
    } else {
      // Canvas not ready, try again after a small delay
      setTimeout(async () => {
        if (qrCanvas.value) {
          await QRCode.toCanvas(qrCanvas.value, url, {
            width: qrSize.value,
            margin: 2,
            color: {
              dark: "#03a9f4", // Music Assistant brand blue
              light: "#00000000", // Transparent background
            },
          });
        }
      }, 50);
    }
  } catch (error) {
    console.error("Failed to generate QR code:", error);
    guestAccessEnabled.value = false;
    qrCodeUrl.value = "";
  } finally {
    loading.value = false;
  }
};

onMounted(async () => {
  await generateQRCode();

  // Initialize remote access status tracking
  await checkRemoteAccessStatus();

  // Poll for remote access status changes every 2 seconds
  remoteAccessPollInterval = setInterval(checkRemoteAccessStatus, 2000);

  // Set up ResizeObserver to regenerate QR code when container size changes
  if (qrContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (qrCodeUrl.value && qrCanvas.value) {
        const newSize = calculateQRSize();
        if (newSize !== qrSize.value) {
          qrSize.value = newSize;
          QRCode.toCanvas(qrCanvas.value, qrCodeUrl.value, {
            width: qrSize.value,
            margin: 2,
            color: {
              dark: "#03a9f4",
              light: "#00000000",
            },
          });
        }
      }
    });
    resizeObserver.observe(qrContainer.value);
  }

  // Subscribe to PROVIDERS_UPDATED to detect when party_mode provider is reloaded
  // When config changes, the provider is unloaded and reloaded, firing this event twice
  unsubscribe = api.subscribe(EventType.PROVIDERS_UPDATED, async () => {
    // Check if party_mode provider exists
    const hasPartyMode = Object.values(api.providers).some(
      (p) => p.domain === "party_mode",
    );
    if (hasPartyMode) {
      // Regenerate QR code to reflect any config changes
      // This will fetch the latest URL from the backend with updated config
      await generateQRCode();
    } else {
      // Provider was unloaded, clear the QR code and mark as disabled
      guestAccessEnabled.value = false;
      qrCodeUrl.value = "";
    }
  });
});

onUnmounted(() => {
  if (unsubscribe) {
    unsubscribe();
  }
  if (resizeObserver) {
    resizeObserver.disconnect();
  }
  if (remoteAccessPollInterval) {
    clearInterval(remoteAccessPollInterval);
  }
});
</script>

<style scoped>
.qr-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  width: 100%;
  height: 100%;
}

.qr-display {
  text-align: center;
  padding: 2rem;
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

.qr-error {
  text-align: center;
  opacity: 0.6;
}

.qr-error p {
  margin-top: 0.5rem;
  color: rgba(255, 100, 100, 0.8);
}

.qr-hint {
  font-size: 0.75rem;
  margin-top: 0.25rem !important;
  opacity: 0.7;
}
</style>
