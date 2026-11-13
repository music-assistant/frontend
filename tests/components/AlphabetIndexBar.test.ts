import AlphabetIndexBar from "@/components/AlphabetIndexBar.vue";
import type { IndexLetter } from "@/composables/useLetterIndex";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

enableAutoUnmount(afterEach);

const LETTERS: IndexLetter[] = ["A", "B", "C", "D"].map((label) => ({
  label,
  available: label !== "B",
}));

const BAR_HEIGHT = 400;

type Jump = (label: string) => Promise<void>;

function mountBar(props: Partial<{ current: string | null; jump: Jump }> = {}) {
  const wrapper = mount(AlphabetIndexBar, {
    props: { letters: LETTERS, jump: vi.fn(async () => {}), ...props },
    attachTo: document.body,
    global: { mocks: { $t: (key: string) => key } },
  });
  // the bar's rows pick the letters, so the test gives it a height
  wrapper.get("nav").element.getBoundingClientRect = () =>
    ({ top: 0, height: BAR_HEIGHT, left: 0, width: 24 }) as DOMRect;
  return wrapper;
}

const pointer = (type: string, clientY: number, pointerType = "mouse") =>
  new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    clientY,
    pointerId: 1,
    pointerType,
  });

const active = (wrapper: ReturnType<typeof mountBar>) =>
  wrapper.find("[aria-current]").text();

const jumps = (wrapper: ReturnType<typeof mountBar>) =>
  (wrapper.props("jump") as ReturnType<typeof vi.fn>).mock.calls.flat();

describe("AlphabetIndexBar", () => {
  it("picks the letter under the pointer and the letters it scrubs over", async () => {
    const wrapper = mountBar();
    const nav = wrapper.get("nav");

    nav.element.dispatchEvent(pointer("pointerdown", 10));
    await nav.trigger("pointermove", { clientY: 10 });
    nav.element.dispatchEvent(pointer("pointermove", 250));
    await wrapper.vm.$nextTick();

    expect(jumps(wrapper)).toEqual(["A", "C"]);
    expect(active(wrapper)).toBe("C");
    expect(wrapper.get("[aria-hidden]").text()).toBe("C");
  });

  it("buzzes a finger once per letter it reaches", () => {
    const vibrate = vi.fn();
    vi.stubGlobal("navigator", { ...navigator, vibrate });
    const wrapper = mountBar();
    const nav = wrapper.get("nav");

    nav.element.dispatchEvent(pointer("pointerdown", 10, "touch"));
    nav.element.dispatchEvent(pointer("pointermove", 20, "touch"));
    nav.element.dispatchEvent(pointer("pointermove", 150, "touch"));

    expect(vibrate).toHaveBeenCalledTimes(1);
    vi.unstubAllGlobals();
  });

  it("jumps from the keyboard and walks the letters with the arrow keys", async () => {
    const wrapper = mountBar();
    const buttons = wrapper.findAll("button");

    await buttons[1].trigger("click", { detail: 0 });
    expect(jumps(wrapper)).toEqual(["B"]);

    (buttons[1].element as HTMLButtonElement).focus();
    await wrapper.get("nav").trigger("keydown", { key: "ArrowDown" });

    expect(jumps(wrapper)).toEqual(["B", "C"]);
    expect(document.activeElement).toBe(buttons[2].element);
  });

  it("ignores a click that followed a press, which already jumped", async () => {
    const wrapper = mountBar();

    await wrapper.findAll("button")[0].trigger("click", { detail: 1 });

    expect(jumps(wrapper)).toEqual([]);
  });

  it("marks the letter of the rows on screen while it is not being used", async () => {
    const wrapper = mountBar({ current: "D" });

    expect(active(wrapper)).toBe("D");

    wrapper.get("nav").element.dispatchEvent(pointer("pointerdown", 10));
    await wrapper.vm.$nextTick();

    expect(active(wrapper)).toBe("A");
  });

  it("hands over to the letter at the top once let go and the jump has landed", async () => {
    let land: () => void = () => {};
    const jump = vi.fn(() => new Promise<void>((resolve) => (land = resolve)));
    const wrapper = mountBar({ current: "D", jump });
    const nav = wrapper.get("nav");

    nav.element.dispatchEvent(pointer("pointerdown", 10));
    nav.element.dispatchEvent(pointer("pointerup", 10));
    await wrapper.vm.$nextTick();
    // still on its way: the picked letter stays rather than flicking back
    expect(active(wrapper)).toBe("A");
    expect(wrapper.get("[aria-hidden]").classes()).toContain("opacity-0");

    await wrapper.setProps({ current: "B" });
    land();
    await flushPromises();

    expect(active(wrapper)).toBe("B");
    expect(wrapper.find("[aria-hidden]").exists()).toBe(false);
  });

  it("keeps the picked letter while still pressed after the jump landed", async () => {
    const wrapper = mountBar({ current: "D" });
    const nav = wrapper.get("nav");

    nav.element.dispatchEvent(pointer("pointerdown", 10));
    await flushPromises();
    expect(active(wrapper)).toBe("A");

    nav.element.dispatchEvent(pointer("pointerup", 10));
    await wrapper.vm.$nextTick();

    expect(active(wrapper)).toBe("D");
  });

  it("dims a letter without items", () => {
    const wrapper = mountBar();
    const [a, b] = wrapper.findAll("button");

    expect(a.classes()).toContain("text-primary");
    expect(b.classes()).toContain("text-muted-foreground/40");
  });
});
