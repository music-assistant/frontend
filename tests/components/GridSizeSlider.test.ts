import GridSizeSlider from "@/components/GridSizeSlider.vue";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { defineComponent, h } from "vue";

// shows which count a plural message was asked for with
vi.mock("@/plugins/i18n", () => ({
  $t: (key: string, count?: number) =>
    count === undefined ? key : `${key}:${count}`,
}));

enableAutoUnmount(afterEach);

/** The slider as the listing's menu shows it: last, beneath an ordinary row. */
async function mountInMenu(size = 0) {
  const onChange = vi.fn();
  const onCommit = vi.fn();
  const Menu = defineComponent(
    () => () =>
      h(
        DropdownMenu,
        { open: true, modal: false },
        {
          default: () => [
            h(DropdownMenuTrigger, null, { default: () => "menu" }),
            h(
              DropdownMenuContent,
              { forceMount: true },
              {
                default: () => [
                  h(DropdownMenuItem, null, { default: () => "Thumbs view" }),
                  h(GridSizeSlider, { size, onChange, onCommit }),
                ],
              },
            ),
          ],
        },
      ),
  );
  const wrapper = mount(Menu, { attachTo: document.body });
  await flushPromises();
  const content = document.querySelector<HTMLElement>(
    "[data-reka-menu-content]",
  )!;
  const rows = [...content.querySelectorAll<HTMLElement>('[role="menuitem"]')];
  const thumb = content.querySelector<HTMLElement>('[role="slider"]')!;
  return { wrapper, content, rows, thumb, onChange, onCommit };
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
});
