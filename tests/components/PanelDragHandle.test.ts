import PanelDragHandle from "@/components/PanelDragHandle.vue";
import { mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

afterEach(() => {
  vi.useRealTimers();
  document.body.replaceChildren();
});

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
});
