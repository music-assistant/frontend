import {
  type Ref,
  nextTick,
  onBeforeUnmount,
  onMounted,
  ref,
  watch,
} from "vue";
import { useSidebar } from "@/components/ui/sidebar";

/**
 * Adjusts --sidebar-width-icon and scrollbarGutter on the collapsed sidebar
 * when the content overflows vertically, preventing the scrollbar from
 * clipping thumbnail icons.
 */
export function applySidebarScrollbarGutter(
  navEl: HTMLElement | null,
  isCollapsed: boolean,
): void {
  const contentEl = navEl?.closest<HTMLElement>("[data-slot=sidebar-content]");
  const sidebarEl = navEl?.closest<HTMLElement>("[data-slot=sidebar]");
  if (!contentEl || !sidebarEl) return;

  const overflows =
    isCollapsed && contentEl.scrollHeight > contentEl.clientHeight;

  if (overflows) {
    // Read the base value only when no override is set yet, so we don't
    // accumulate additions on repeated calls.
    if (!sidebarEl.style.getPropertyValue("--sidebar-width-icon")) {
      const base =
        getComputedStyle(sidebarEl)
          .getPropertyValue("--sidebar-width-icon")
          .trim() || "3rem";
      sidebarEl.style.setProperty(
        "--sidebar-width-icon",
        `calc(${base} + 6px)`,
      );
    }
    contentEl.style.scrollbarGutter = "stable";
  } else {
    sidebarEl.style.removeProperty("--sidebar-width-icon");
    contentEl.style.scrollbarGutter = "";
  }
}

/**
 * Composable that manages the collapsed-sidebar scrollbar gutter.
 * Returns a navEl ref to be placed as a template ref inside the sidebar
 * content so DOM ancestors can be located via closest().
 *
 * :param triggerRef: A reactive list whose changes (e.g. added/removed
 *   shortcuts) should re-evaluate the overflow state after the next tick.
 */
export function useSidebarScrollbarGutter<T>(triggerRef: Ref<T[]>) {
  const navEl = ref<HTMLElement | null>(null);
  const { state } = useSidebar();

  let resizeObserver: ResizeObserver | null = null;

  const update = () =>
    applySidebarScrollbarGutter(navEl.value, state.value === "collapsed");

  watch(state, update);
  watch(triggerRef, () => nextTick(update));

  onMounted(() => {
    const contentEl = navEl.value?.closest<HTMLElement>(
      "[data-slot=sidebar-content]",
    );
    update();
    if (contentEl) {
      resizeObserver = new ResizeObserver(update);
      resizeObserver.observe(contentEl);
    }
  });

  onBeforeUnmount(() => {
    resizeObserver?.disconnect();
  });

  return { navEl };
}
