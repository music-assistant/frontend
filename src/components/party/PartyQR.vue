<template>
  <div ref="qrContainer" class="qr-container">
    <div v-if="loading" class="qr-loading">
      <Spinner class="size-12" />
    </div>
    <div
      v-else-if="qrCodeUrl"
      class="qr-display"
      :style="{
        '--qr-size': qrSize + 'px',
        '--qr-color': props.qrDark,
      }"
    >
      <button
        type="button"
        class="qr-link"
        :aria-label="$t('providers.party.copy_link')"
        @click="copyUrlToClipboard"
      >
        <canvas ref="qrCanvas"></canvas>
        <Transition name="copy-toast">
          <div
            v-if="copyFeedback"
            class="copy-bubble"
            :class="{ 'copy-bubble--error': !copySucceeded }"
          >
            <Check v-if="copySucceeded" :size="16" />
            <AlertCircle v-else :size="16" />
            {{ copyFeedback }}
          </div>
        </Transition>
      </button>
      <p
        v-if="qrText"
        :style="{ width: qrSize + 'px', textAlign: 'center' }"
        class="qr-text"
      >
        {{ qrText }}
      </p>
      <InvitationShareActions
        ref="shareActions"
        class="qr-actions"
        variant="ghost-outline"
        :join-link="qrCodeUrl"
        :title="shareTitle"
        :description="shareDescription"
        :copy-label="$t('providers.party.copy_link')"
        :copied-label="$t('providers.party.link_copy_success')"
        :more-options-label="$t('providers.party.more_share_options')"
        :share-label="$t('providers.party.share_invitation')"
        :share-failed-message="$t('providers.party.share_failed')"
        @copied="handleCopyResult"
      />
    </div>
    <div v-else class="qr-error">
      <AlertCircle :size="64" />
      <p>{{ $t("providers.party.qr_failed") }}</p>
      <p class="qr-hint">{{ $t("providers.party.check_network") }}</p>
    </div>
  </div>
</template>

<script setup lang="ts">
import InvitationShareActions from "@/components/InvitationShareActions.vue";
import { Spinner } from "@/components/ui/spinner";
import { usePartyConfig } from "@/composables/usePartyConfig";
import api from "@/plugins/api";
import { EventType } from "@/plugins/api/interfaces";
import { $t } from "@/plugins/i18n";
import { AlertCircle, Check } from "@lucide/vue";
import QRCode from "qrcode";
import { computed, onBeforeUnmount, onMounted, ref, watch } from "vue";

const props = withDefaults(
  defineProps<{
    qrDark?: string;
    qrLight?: string;
  }>(),
  {
    qrDark: "#FFFFFF",
    qrLight: "#00000000",
  },
);

const emit = defineEmits<{ available: [value: boolean] }>();

const { config: partyConfig } = usePartyConfig();

const qrText = computed(
  () =>
    partyConfig.value?.qr_text?.trim() || $t("providers.party.qr_default_text"),
);
const shareTitle = computed(() => {
  const partyName = partyConfig.value?.party_name?.trim();
  return partyName
    ? $t("providers.party.share_named_title", [partyName])
    : $t("providers.party.share_title");
});
const shareDescription = computed(
  () =>
    partyConfig.value?.qr_text?.trim() ||
    $t("providers.party.share_description"),
);

const qrCanvas = ref<HTMLCanvasElement | null>(null);
const qrContainer = ref<HTMLElement | null>(null);
const shareActions = ref<InstanceType<typeof InvitationShareActions> | null>(
  null,
);
const qrCodeUrl = ref<string>("");
const guestAccessEnabled = ref<boolean>(false);
const loading = ref(true);
const qrSize = ref(320);
const copyFeedback = ref<string>("");
const copySucceeded = ref(false);
let copyFeedbackTimeout: ReturnType<typeof setTimeout> | undefined;
let resizeObserver: ResizeObserver | null = null;
let unsubProviders: (() => void) | undefined;
let unsubCoreState: (() => void) | undefined;
let unmounted = false;

function copyUrlToClipboard() {
  void shareActions.value?.copyLink();
}

function handleCopyResult(success: boolean) {
  copySucceeded.value = success;
  copyFeedback.value = success
    ? $t("providers.party.link_copy_success")
    : $t("providers.party.link_copy_fail");
  if (copyFeedbackTimeout) clearTimeout(copyFeedbackTimeout);
  copyFeedbackTimeout = setTimeout(() => {
    copyFeedback.value = "";
  }, 2000);
}

// Render QR code when canvas mounts (after v-if switches to the qr-display branch)
watch(qrCanvas, (canvas) => {
  if (canvas) renderQRToCanvas();
});

// Re-render when colors change (e.g., empty-state vs album-art mode)
watch(
  () => [props.qrDark, props.qrLight],
  () => {
    if (qrCanvas.value && qrCodeUrl.value) renderQRToCanvas();
  },
);

onMounted(async () => {
  await generateQRCode();
  if (unmounted) return;

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
  unsubProviders = api.subscribe(EventType.PROVIDERS_UPDATED, async () => {
    const hasParty = Object.values(api.providers).some(
      (p) => p.domain === "party",
    );
    if (hasParty) {
      await generateQRCode();
    } else {
      guestAccessEnabled.value = false;
      qrCodeUrl.value = "";
      emit("available", false);
    }
  });
  // Subscribe to CORE_STATE_UPDATED to detect when remote access is toggled,
  // which changes the party join URL between local and remote.
  unsubCoreState = api.subscribe(EventType.CORE_STATE_UPDATED, async () => {
    const hasParty = Object.values(api.providers).some(
      (p) => p.domain === "party",
    );
    if (hasParty) {
      await generateQRCode();
    }
  });
});

onBeforeUnmount(() => {
  unmounted = true;
  if (copyFeedbackTimeout) clearTimeout(copyFeedbackTimeout);
  resizeObserver?.disconnect();
  unsubProviders?.();
  unsubCoreState?.();
});

function calculateQRSize() {
  if (!qrContainer.value) return 320;
  const containerWidth = qrContainer.value.clientWidth;
  const containerHeight = qrContainer.value.clientHeight;
  // Use the smaller dimension, leaving room for the text and sharing controls.
  const availableSize = Math.min(containerWidth, containerHeight) - 180;
  // Clamp between 160 and 1024 for usability (supports 4K displays)
  return Math.max(160, Math.min(1024, availableSize));
}

async function renderQRToCanvas() {
  if (!qrCanvas.value || !qrCodeUrl.value) return;
  qrSize.value = calculateQRSize();
  await QRCode.toCanvas(qrCanvas.value, qrCodeUrl.value, {
    width: qrSize.value,
    margin: 2,
    color: {
      dark: props.qrDark,
      light: props.qrLight,
    },
  });
}

async function generateQRCode() {
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
    emit("available", guestAccessEnabled.value);
  }
}
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
  gap: 0.5rem;
  padding: 1rem;
  padding-bottom: 0.5rem;
}

.qr-link {
  position: relative;
  display: block;
  padding: 0;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  transition:
    transform 0.2s ease,
    opacity 0.2s ease;
}

.qr-link:hover {
  transform: scale(1.05);
  opacity: 0.9;
}

.qr-link:focus-visible {
  outline: 3px solid var(--qr-color);
  outline-offset: 4px;
}

.qr-text {
  margin: 0;
}

.qr-actions {
  margin-top: 0.25rem;
}

.qr-actions :deep([data-slot="button"]) {
  border-color: var(--qr-color);
  background: rgba(127, 127, 127, 0.12);
  color: var(--qr-color);
}

.qr-actions :deep([data-slot="button"]:hover) {
  background: rgba(127, 127, 127, 0.28);
  color: var(--qr-color);
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
  background: black;
  color: white;
  font-size: 0.9rem;
  font-weight: 600;
  border-radius: 8px;
  white-space: nowrap;
  pointer-events: none;
  box-shadow: 0 4px 12px rgba(0, 0, 0, 0.4);
}

.copy-bubble--error {
  background: #991b1b;
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
