import PanelDragHandle from "@/components/PanelDragHandle.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

/** Panel + content element the swipe starts from, outside any drag region. */
function mountWithContent(swipeAnywhere = true) {
  const panel = document.createElement("div");
  panel.dataset.playerPanel = "";
  document.body.appendChild(panel);
  const wrapper = mount(PanelDragHandle, {
    attachTo: panel,
    props: { swipeAnywhere },
    global: {
      mocks: {
        $t: (key: string) => key,
      },
    },
  });
  panel.setPointerCapture = vi.fn();
  panel.hasPointerCapture = vi.fn(() => true);
  panel.releasePointerCapture = vi.fn();
  const content = document.createElement("div");
  panel.appendChild(content);
  return { panel, wrapper, content };
}

/** Dispatches a bubbling pointer event defaulting to a primary touch pointer. */
function firePointer(el: Element, type: string, props: PointerEventInit) {
  const event = new PointerEvent(type, {
    bubbles: true,
    cancelable: true,
    button: 0,
    isPrimary: true,
    pointerType: "touch",
    clientX: 0,
    clientY: 0,
    ...props,
  });
  el.dispatchEvent(event);
  return event;
}

describe("PanelDragHandle", () => {
  it("supports keyboard dismissal", async () => {
    const wrapper = mount(PanelDragHandle, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });

    await wrapper.trigger("keydown", { key: "Enter" });

    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  it("dismisses after dragging down", async () => {
    vi.useFakeTimers();
    const panel = document.createElement("div");
    panel.dataset.playerPanel = "";
    document.body.appendChild(panel);
    const wrapper = mount(PanelDragHandle, {
      attachTo: panel,
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
    });
    panel.setPointerCapture = vi.fn();
    panel.hasPointerCapture = vi.fn(() => true);
    panel.releasePointerCapture = vi.fn();

    await wrapper.trigger("pointerdown", {
      button: 0,
      pointerId: 1,
      clientY: 10,
    });
    await wrapper.trigger("pointermove", {
      pointerId: 1,
      clientY: 40,
    });
    expect(panel.style.transform).toBe("translate3d(0, 30px, 0)");
    expect(panel.style.getPropertyPriority("transform")).toBe("important");

    await wrapper.trigger("pointerup", {
      pointerId: 1,
      clientY: 40,
    });
    expect(panel.dataset.dragDismissed).toBe("true");
    await vi.advanceTimersByTimeAsync(170);

    expect(wrapper.emitted("dismiss")).toHaveLength(1);
  });

  describe("swipe anywhere", () => {
    it("dismisses after a downward swipe from panel content", async () => {
      vi.useFakeTimers();
      const { panel, wrapper, content } = mountWithContent();

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      // crosses the slop: engages with its own position as the baseline
      firePointer(content, "pointermove", { pointerId: 1, clientY: 112 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 200 });
      expect(panel.style.transform).toBe("translate3d(0, 88px, 0)");

      firePointer(content, "pointerup", { pointerId: 1, clientY: 200 });
      expect(panel.dataset.dragDismissed).toBe("true");
      await vi.advanceTimersByTimeAsync(170);

      expect(wrapper.emitted("dismiss")).toHaveLength(1);
    });

    it("keeps a short swipe below the dismiss threshold open", () => {
      const { panel, wrapper, content } = mountWithContent();

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 112 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 150 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 150 });

      expect(panel.dataset.dragDismissed).toBeUndefined();
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("does nothing without the swipeAnywhere prop", () => {
      const { panel, wrapper, content } = mountWithContent(false);

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 200 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 200 });

      expect(panel.style.transform).toBe("");
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("leaves taps alone: no capture before the gesture engages", () => {
      const { panel, wrapper, content } = mountWithContent();

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 100 });

      expect(panel.setPointerCapture).not.toHaveBeenCalled();
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("leaves horizontal gestures alone, even if they later move down", () => {
      const { panel, wrapper, content } = mountWithContent();

      firePointer(content, "pointerdown", {
        pointerId: 1,
        clientX: 50,
        clientY: 100,
      });
      // horizontal dominance at the slop boundary: gesture is not ours
      firePointer(content, "pointermove", {
        pointerId: 1,
        clientX: 80,
        clientY: 104,
      });
      firePointer(content, "pointermove", {
        pointerId: 1,
        clientX: 80,
        clientY: 300,
      });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 300 });

      expect(panel.style.transform).toBe("");
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("leaves swipes inside a scrolled container alone", () => {
      const { panel, wrapper, content } = mountWithContent();
      const scroller = document.createElement("div");
      panel.appendChild(scroller);
      scroller.appendChild(content);
      Object.defineProperty(scroller, "scrollTop", { value: 5 });

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 200 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 200 });

      expect(panel.style.transform).toBe("");
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("leaves swipes starting on a slider alone", () => {
      const { panel, wrapper, content } = mountWithContent();
      const slider = document.createElement("div");
      slider.dataset.slot = "slider";
      panel.appendChild(slider);
      slider.appendChild(content);

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 200 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 200 });

      expect(panel.style.transform).toBe("");
      expect(wrapper.emitted("dismiss")).toBeUndefined();
    });

    it("swallows the click that follows an engaged swipe", async () => {
      vi.useFakeTimers();
      const { content } = mountWithContent();

      firePointer(content, "pointerdown", { pointerId: 1, clientY: 100 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 112 });
      firePointer(content, "pointermove", { pointerId: 1, clientY: 150 });
      firePointer(content, "pointerup", { pointerId: 1, clientY: 150 });

      const ghostClick = new Event("click", {
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(ghostClick);
      expect(ghostClick.defaultPrevented).toBe(true);

      await vi.advanceTimersByTimeAsync(500);
      const laterClick = new Event("click", {
        bubbles: true,
        cancelable: true,
      });
      content.dispatchEvent(laterClick);
      expect(laterClick.defaultPrevented).toBe(false);
    });
  });
});
