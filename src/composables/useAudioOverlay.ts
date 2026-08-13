// Shared state and helpers for the per-queue audio overlay: a looping sound
// effect (rain, white noise, ...) mixed into the queue's playback. The overflow
// menu item and the fullscreen "active" pill both use these, so availability
// detection and the sound-effect catalog live in one place.
import api from "@/plugins/api";
import { ProviderFeature, type SoundEffect } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { computed, ref } from "vue";

// The catalog is fetched on demand (when the overlay dialog opens) and kept
// module-level so it is shared and survives dialog re-opens.
const soundEffects = ref<SoundEffect[]>([]);
const loading = ref(false);

// The overlay is only offered when at least one available provider can supply
// sound effects. Reactive on api.providers, so no network call is needed to
// decide whether to show the menu item.
const overlayAvailable = computed(() =>
  Object.values(api.providers).some(
    (provider) =>
      provider.available &&
      provider.supported_features.includes(ProviderFeature.SOUND_EFFECTS),
  ),
);

export function useAudioOverlay() {
  return {
    soundEffects,
    loading,
    overlayAvailable,
    loadSoundEffects,
    openOverlayDialog,
  };
}

async function loadSoundEffects(): Promise<void> {
  loading.value = true;
  try {
    soundEffects.value = await api.getSoundEffects();
  } catch {
    // keep any previously loaded catalog on failure
  } finally {
    loading.value = false;
  }
}

function openOverlayDialog(queueId: string): void {
  eventbus.emit("audioOverlayDialog", { queueId });
}
