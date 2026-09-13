import { computed, onMounted, onUnmounted } from "vue";
import { usePlayPauseCommand } from "@/composables/usePlayPauseCommand";
import { store } from "@/plugins/store";

// Whatever holds focus gets Space, but we check what the element is, not what
// the browser focused: click focus differs per browser and version, and a
// focused scroller or a tabindex="-1" park must not turn the shortcut off.
const FOCUSABLE =
  'a[href], button, input, select, textarea, [contenteditable]:not([contenteditable="false"]), [tabindex]:not([tabindex="-1"])';

function focusedControlOwnsSpace(target: EventTarget | null): boolean {
  return target instanceof Element && target.matches(FOCUSABLE);
}

// Space toggles playback on the active player
export function usePlayPauseShortcut() {
  const player = computed(() => store.activePlayer);
  const playerQueue = computed(() => store.activePlayerQueue);
  const { isDisabled, playPause } = usePlayPauseCommand(player, playerQueue);

  const onKeydown = (event: KeyboardEvent) => {
    if (event.key !== " ") return;
    if (event.repeat) return;
    if (event.metaKey || event.ctrlKey || event.altKey || event.shiftKey)
      return;
    if (store.dialogActive || store.showPlayersMenu) return;
    if (focusedControlOwnsSpace(event.target)) return;
    if (isDisabled.value) return;

    // Space scrolls the page unless we claim it
    event.preventDefault();
    playPause();
  };

  onMounted(() => {
    window.addEventListener("keydown", onKeydown);
  });

  onUnmounted(() => {
    window.removeEventListener("keydown", onKeydown);
  });
}
