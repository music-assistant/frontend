<template>
  <div ref="qrContainer" class="qr-container">
    <div v-if="loading" class="qr-loading">
      <Spinner class="size-12" />
    </div>
    <div v-else-if="!guestAccessEnabled" class="qr-disabled">
      <QrCode class="qr-disabled-icon" />
      <p class="qr-disabled-title">
        {{ $t("providers.party.guest_access_disabled") }}
      </p>
      <p class="qr-hint">{{ $t("providers.party.enable_in_settings") }}</p>
    </div>
    <div
      v-else-if="qrCodeUrl"
      class="qr-display"
      :style="{ '--qr-size': qrSize + 'px' }"
    >
      <div class="qr-link" @click="copyUrlToClipboard">
        <canvas ref="qrCanvas"></canvas>
        <Transition name="copy-toast">
          <div v-if="copyFeedback" class="copy-bubble">
            <Check :size="16" />
            {{ copyFeedback }}
          </div>
        </Transition>
      </div>
      <img src="@/assets/logo.svg" class="qr-logo" alt="Music Assistant" />
    </div>
    <div v-else class="qr-error">
      <AlertCircle :size="64" />
      <p>{{ $t("providers.party.qr_failed") }}</p>
      <p class="qr-hint">{{ $t("providers.party.check_network") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import { Spinner } from "@/components/ui/spinner";
import { copyToClipboard } from "@/helpers/utils";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { AlertCircle, Check, QrCode } from "lucide-vue-next";
import QRCode from "qrcode";
import { onBeforeUnmount, onMounted, ref, watch } from "vue";

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrContainer = ref<HTMLElement | null>(null);
const qrCodeUrl = ref<string>("");
const guestAccessEnabled = ref<boolean>(false);
const loading = ref(true);
const qrSize = ref(320);
const copyFeedback = ref<string>("");
let resizeObserver: ResizeObserver | null = null;

const calculateQRSize = () => {
  if (!qrContainer.value) return 320;
  const containerWidth = qrContainer.value.clientWidth;
  const containerHeight = qrContainer.value.clientHeight;
  // Use the smaller dimension, leave room for padding and instructions
  const availableSize = Math.min(containerWidth, containerHeight) - 120;
  // Clamp between 160 and 1024 for usability (supports 4K displays)
  return Math.max(160, Math.min(1024, availableSize));
};

const copyUrlToClipboard = async () => {
  if (!qrCodeUrl.value) return;
  const success = await copyToClipboard(qrCodeUrl.value);
  copyFeedback.value = success
    ? $t("providers.party.link_copy_success")
    : $t("providers.party.link_copy_fail");
  setTimeout(() => {
    copyFeedback.value = "";
  }, 2000);
};

const renderQRToCanvas = async () => {
  if (!qrCanvas.value || !qrCodeUrl.value) return;
  qrSize.value = calculateQRSize();
  await QRCode.toCanvas(qrCanvas.value, qrCodeUrl.value, {
    width: qrSize.value,
    margin: 2,
    color: {
      dark: "#FFFFFF",
      light: "#00000000",
    },
  });
};

// Render QR code when canvas mounts (after v-if switches to the qr-display branch)
watch(qrCanvas, (canvas) => {
  if (canvas) renderQRToCanvas();
});

const generateQRCode = async () => {
  loading.value = true;
  try {
    const url = (await api.sendCommand("party/url")) as string | null;

    guestAccessEnabled.value = !!url;

    if (!url) {
      qrCodeUrl.value = "";
      return;
    }

    // Set URL — the watch on qrCanvas handles initial mount rendering
    qrCodeUrl.value = url;

    // If canvas is already mounted (e.g., re-generating after config change), render now
    if (qrCanvas.value) {
      await renderQRToCanvas();
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

  // Set up ResizeObserver to regenerate QR code when container size changes
  if (qrContainer.value) {
    resizeObserver = new ResizeObserver(() => {
      if (qrCodeUrl.value && qrCanvas.value) {
        const newSize = calculateQRSize();
        if (newSize !== qrSize.value) {
          renderQRToCanvas();
        }
      }
    });
    resizeObserver.observe(qrContainer.value);
  }

  // Subscribe to PROVIDERS_UPDATED to detect when party provider is
  // loaded/unloaded. Config refresh is handled by the composable automatically.
  const unsubProviders = api.subscribe(
    EventType.PROVIDERS_UPDATED,
    async () => {
      const hasParty = Object.values(api.providers).some(
        (p) => p.domain === "party",
      );
      if (hasParty) {
        await generateQRCode();
      } else {
        guestAccessEnabled.value = false;
        qrCodeUrl.value = "";
      }
    },
  );
  onBeforeUnmount(unsubProviders);

  // Subscribe to CORE_STATE_UPDATED to detect when remote access is toggled,
  // which changes the party join URL between local and remote.
  const unsubCoreState = api.subscribe(
    EventType.CORE_STATE_UPDATED,
    async () => {
      const hasParty = Object.values(api.providers).some(
        (p) => p.domain === "party",
      );
      if (hasParty) {
        await generateQRCode();
      }
    },
  );
  onBeforeUnmount(unsubCoreState);
});

onBeforeUnmount(() => {
  if (resizeObserver) {
    resizeObserver.disconnect();
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
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  padding: 1rem;
  padding-bottom: 0.5rem;
  background: rgba(0, 0, 0, 0.3);
  border-radius: clamp(12px, 1.2vw, 24px);
  backdrop-filter: blur(10px);
  box-shadow: 0 4px 20px rgba(0, 0, 0, 0.3);
}

.qr-link {
  position: relative;
  display: block;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.qr-logo {
  width: calc(var(--qr-size) * 0.8);
  height: auto;
  margin-top: 0.375rem;
  opacity: 0.85;
}

.qr-link:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.copy-bubble {
  position: absolute;
  top: 50%;
  left: 50%;
  transform: translate(-50%, -50%);
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  background: rgba(var(--v-theme-surface), 0.9);
  color: rgb(var(--v-theme-success));
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.copy-toast-enter-active {
  transition: all 0.2s ease-out;
}

.copy-toast-leave-active {
  transition: all 0.3s ease-in;
}

.copy-toast-enter-from {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.copy-toast-leave-to {
  opacity: 0;
  transform: translate(-50%, -50%) scale(0.8);
}

.qr-display canvas {
  display: block;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
}

.qr-disabled {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
  padding: 3rem;
}

.qr-disabled-icon {
  width: clamp(64px, 10vw, 120px);
  height: clamp(64px, 10vw, 120px);
  opacity: 0.5;
  margin-bottom: 1.5rem;
}

.qr-disabled-title {
  font-size: 2rem;
  font-weight: 600;
  margin-bottom: 1rem;
  color: rgba(255, 255, 255, 0.9);
}

.qr-disabled .qr-hint {
  font-size: 1.25rem;
  color: rgba(255, 255, 255, 0.7);
  max-width: 500px;
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
