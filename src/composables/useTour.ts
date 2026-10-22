import { ref } from "vue";

// Whether the tour is running. Module-level so it can be started from the
// profile menu and from the end of onboarding alike, and the overlay in the
// layout picks it up wherever the app is.
const active = ref(false);

function start(): void {
  active.value = true;
}

function end(): void {
  active.value = false;
}

/**
 * The guided tour's on/off switch, shared by whoever starts it and the overlay
 * that walks the stops.
 */
export function useTour() {
  return { active, start, end };
}
