import { ref, onScopeDispose } from "vue";

/**
 * Lightweight reactive dark mode check.
 * Watches for the `.dark` class on <html> (set by useColorMode in App.vue)
 * without pulling in the entire @vueuse/core bundle.
 */
const isDark = ref(document.documentElement.classList.contains("dark"));

let observer: MutationObserver | null = null;
let refCount = 0;

function startObserver() {
  if (observer) return;
  observer = new MutationObserver(() => {
    isDark.value = document.documentElement.classList.contains("dark");
  });
  observer.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ["class"],
  });
}

function stopObserver() {
  if (observer) {
    observer.disconnect();
    observer = null;
  }
}

export function useIsDark() {
  refCount++;
  startObserver();
  onScopeDispose(() => {
    refCount--;
    if (refCount === 0) stopObserver();
  });
  return { isDark };
}
