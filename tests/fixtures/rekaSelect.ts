/**
 * Drives a reka-ui Select the way a pointer does.
 *
 * The listbox is portalled out of the wrapper and reka settles its focus on a
 * timer rather than a microtask, so a test cannot reach an option through the
 * wrapper or after a plain flush.
 */
import { flushPromises, type VueWrapper } from "@vue/test-utils";
import { vi } from "vitest";

const settle = async () => {
  await flushPromises();
  // suites that fake timers have to advance them for reka's focus timer to run
  if (vi.isFakeTimers()) await vi.advanceTimersByTimeAsync(30);
  else await new Promise((resolve) => setTimeout(resolve, 30));
  await flushPromises();
};

/** Opens the select whose trigger carries `triggerSelector`. */
export async function openSelect(wrapper: VueWrapper, triggerSelector: string) {
  const trigger = wrapper.get(triggerSelector);
  await trigger.trigger("pointerdown", { button: 0, pointerType: "mouse" });
  await trigger.trigger("click");
  await settle();
}

/** Every option of the currently open select, in render order. */
export function selectOptions(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>('[data-slot="select-item"]'),
  );
}

/**
 * Picks the option whose label contains `label` from the select whose trigger
 * carries `triggerSelector`.
 */
export async function pickSelectOption(
  wrapper: VueWrapper,
  triggerSelector: string,
  label: string,
) {
  await openSelect(wrapper, triggerSelector);
  const option = selectOptions().find((item) =>
    item.textContent?.includes(label),
  );
  if (!option) {
    throw new Error(
      `no option matching "${label}" in ${triggerSelector}; found: ${selectOptions()
        .map((item) => item.textContent?.trim())
        .join(", ")}`,
    );
  }
  option.dispatchEvent(new PointerEvent("pointerup", { bubbles: true }));
  await settle();
}
