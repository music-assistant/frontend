import GridSizeSlider from "@/components/GridSizeSlider.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { TooltipProvider } from "@/components/ui/tooltip";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h, reactive } from "vue";

// shows which count a plural message was asked for with
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: number) =>
    count === undefined ? key : `${key}:${count}`,
}));

enableAutoUnmount(afterEach);

/** The slider as the listing's menu shows it: last, beneath an ordinary row. */
async function mountInMenu(size = 0) {
  const state = reactive({
    size,
    showActions: true,
    actionsFit: true,
    supportsActions: true,
  });
  const onChange = vi.fn((size: number) => {
    state.size = size;
  });
  const onCommit = vi.fn();
  const Menu = defineComponent(
    () => () =>
      h(
        DropdownMenu,
        { open: true },
        {
          default: () => [
            h(DropdownMenuTrigger, null, { default: () => "menu" }),
            h(
              DropdownMenuContent,
              { forceMount: true },
              {
                default: () => [
                  h(DropdownMenuItem, null, { default: () => "Thumbs view" }),
                  h(GridSizeSlider, {
                    ...state,
                    onChange,
                    onCommit,
                    onToggleActions: (show: boolean) => {
                      state.showActions = show;
                    },
                  }),
                ],
              },
            ),
          ],
        },
      ),
  );
  const wrapper = mount(TooltipProvider, {
    attachTo: document.body,
    props: { delayDuration: 0 },
    slots: { default: () => h(Menu) },
  });
  await flushPromises();
  const content = document.querySelector<HTMLElement>(
    "[data-reka-menu-content]",
  )!;
  const rows = [...content.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const thumb = content.querySelector<HTMLElement>('[role="slider"]')!;
  return {
    wrapper,
    content,
    rows,
    thumb,
    state,
    onChange,
    onCommit,
  };
}

describe("GridSizeSlider", () => {
  it("is reached by arrowing down from the row above it", async () => {
    const { rows, thumb } = await mountInMenu();

    rows[0].focus();
    rows[0].dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowDown", bubbles: true }),
    );

    expect(document.activeElement).toBe(thumb);
  });

  it("keeps the slider's keys from moving through the menu", async () => {
    const { content, thumb, onChange } = await mountInMenu();
    const menuKeys = vi.fn();
    content.addEventListener("keydown", menuKeys);

    thumb.focus();
    for (const key of ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]) {
      thumb.dispatchEvent(new KeyboardEvent("keydown", { key, bubbles: true }));
    }

    expect(menuKeys).not.toHaveBeenCalled();
    expect(onChange).toHaveBeenCalled();
    expect(document.activeElement).toBe(thumb);
  });

  it("starts where the listing's size is, and reports each step", async () => {
    const { thumb, onChange, onCommit } = await mountInMenu(-1);

    expect(thumb.getAttribute("aria-valuenow")).toBe("-1");

    thumb.focus();
    thumb.dispatchEvent(
      new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
    );
    await flushPromises();

    expect(onChange).toHaveBeenLastCalledWith(0);
    expect(onCommit).toHaveBeenLastCalledWith(0);
    expect(thumb.getAttribute("aria-valuenow")).toBe("0");
  });

  it("names the slider, and reads its size out as smaller or larger", async () => {
    const { thumb } = await mountInMenu(-2);

    expect(thumb.getAttribute("aria-label")).toBe("grid_size");
    expect(thumb.getAttribute("aria-valuetext")).toBe("grid_size_smaller:2");

    thumb.focus();
    for (const expected of [
      "grid_size_smaller:1",
      "grid_size_default",
      "grid_size_larger:1",
    ]) {
      thumb.dispatchEvent(
        new KeyboardEvent("keydown", { key: "ArrowRight", bubbles: true }),
      );
      await flushPromises();
      expect(thumb.getAttribute("aria-valuetext")).toBe(expected);
    }
  });

  it("allows Tab and Shift+Tab between the slider and the eye", async () => {
    const { content, thumb } = await mountInMenu();
    const eye = content.querySelector<HTMLButtonElement>("button")!;
    expect(thumb.tabIndex).toBe(0);
    expect(eye.tabIndex).toBe(0);

    for (const [target, shiftKey] of [
      [thumb, false],
      [eye, true],
    ] as const) {
      target.focus();
      const tab = new KeyboardEvent("keydown", {
        key: "Tab",
        shiftKey,
        bubbles: true,
        cancelable: true,
      });
      target.dispatchEvent(tab);
      expect(tab.defaultPrevented).toBe(false);
    }
  });

  it("toggles actions and follows the available space", async () => {
    const { content, state } = await mountInMenu();
    const eye = content.querySelector<HTMLButtonElement>("button")!;
    eye.click();
    await flushPromises();
    expect(eye.getAttribute("aria-pressed")).toBe("false");

    eye.click();
    await flushPromises();
    expect(eye.getAttribute("aria-pressed")).toBe("true");
    state.actionsFit = false;
    await flushPromises();
    expect(eye.disabled).toBe(true);
    content
      .querySelector<HTMLElement>('[data-slot="tooltip-trigger"]')!
      .focus();
    await flushPromises();
    expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
      "action_buttons_too_small",
    );

    state.actionsFit = true;
    await flushPromises();
    expect(eye.disabled).toBe(false);
    expect(eye.getAttribute("aria-pressed")).toBe("true");

    state.supportsActions = false;
    await flushPromises();
    expect(content.querySelector("button")).toBeNull();
  });
});
