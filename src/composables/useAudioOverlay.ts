// Shared state and helpers for the per-queue audio overlay: a looping sound
// effect (rain, white noise, ...) mixed into the queue's playback. The overflow
// menu item and the fullscreen "active" pill both use these, so availability
// detection and the sound-effect catalog live in one place.
import api from "@/plugins/api";
import { ProviderFeature, type SoundEffect } from "@/plugins/api/interfaces";
import { eventbus } from "@/plugins/eventbus";
import { computed, ref } from "vue";

const AMBIENT_SOUNDS_DOMAIN = "ambient_sounds";

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

// Custom ambient sounds (user-added stream urls) can only be managed when the
// ambient sounds provider itself is available.
const ambientSoundsAvailable = computed(
  () => api.getProvider(AMBIENT_SOUNDS_DOMAIN)?.available ?? false,
);

export function useAudioOverlay() {
  return {
    soundEffects,
    loading,
    overlayAvailable,
    ambientSoundsAvailable,
    isCustomAmbientSound,
    loadSoundEffects,
    openOverlayDialog,
  };
}

function isCustomAmbientSound(effect: SoundEffect): boolean {
  // Custom sounds live on the ambient sounds provider with the stream url as
  // item id, unlike the builtin presets which use plain preset ids. Match any
  // url scheme here: the server accepts whatever ffmpeg can probe.
  return (
    api.getProvider(effect.provider)?.domain === AMBIENT_SOUNDS_DOMAIN &&
    effect.item_id.includes("://")
  );
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
