import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

describe("EditorialShelf", () => {
  it("fades each edge only while more content exists in that direction", async () => {
    const wrapper = mount(EditorialShelf, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
      slots: {
        default: '<div class="shelf-item">Item</div>',
      },
    });
    const track = wrapper.get(".ed-shelf__track");
    Object.defineProperties(track.element, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 400 },
      scrollLeft: { configurable: true, value: 0, writable: true },
    });
    await track.trigger("scroll");

    const leftFade = wrapper.get(".ed-shelf__overflow-fade--left");
    const rightFade = wrapper.get(".ed-shelf__overflow-fade--right");
    expect(leftFade.attributes("style")).toContain("visibility: hidden");
    expect(leftFade.attributes("style")).toContain("opacity: 0");
    expect(rightFade.isVisible()).toBe(true);
    expect(rightFade.attributes("style")).toContain("opacity: 1");
    expect(rightFade.attributes("aria-hidden")).toBe("true");

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 14,
    });
    await track.trigger("scroll");

    expect(leftFade.isVisible()).toBe(true);
    expect(leftFade.attributes("style")).toContain("opacity: 0.5");
    expect(rightFade.isVisible()).toBe(true);
    await wrapper.get(".ed-shelf").trigger("mouseenter");
    expect(wrapper.get(".ed-shelf__nav--left").attributes("style")).toContain(
      "opacity: 0.5",
    );

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 186,
    });
    await track.trigger("scroll");

    expect(leftFade.isVisible()).toBe(true);
    expect(rightFade.attributes("style")).toContain("opacity: 0.5");

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 200,
    });
    await track.trigger("scroll");

    expect(rightFade.attributes("style")).toContain("visibility: hidden");
    expect(rightFade.attributes("style")).toContain("opacity: 0");
  });

  it("scrolls an overflowing shelf with its navigation control", async () => {
    const wrapper = mount(EditorialShelf, {
      global: {
        mocks: {
          $t: (key: string) => key,
        },
      },
      slots: {
        default: '<div class="shelf-item">Item</div>',
      },
    });
    const track = wrapper.get(".ed-shelf__track");
    const scrollBy = vi.fn();
    Object.defineProperties(track.element, {
      clientWidth: { configurable: true, value: 200 },
      scrollWidth: { configurable: true, value: 400 },
      scrollLeft: { configurable: true, value: 0, writable: true },
      scrollBy: { configurable: true, value: scrollBy },
    });
    await track.trigger("scroll");
    await wrapper.get(".ed-shelf").trigger("mouseenter");
    await wrapper.get(".ed-shelf__nav--right").trigger("click");

    expect(scrollBy).toHaveBeenCalledWith({
      left: 160,
      behavior: "smooth",
    });
  });
});
