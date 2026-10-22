import EditorialShelf from "@/components/discover/EditorialShelf.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

describe("EditorialShelf", () => {
  it("shows navigation only while more content exists in that direction", async () => {
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
    await wrapper.get(".ed-shelf").trigger("mouseenter");

    const leftNav = wrapper.get(".ed-shelf__nav--left");
    const rightNav = wrapper.get(".ed-shelf__nav--right");
    expect(leftNav.attributes("style")).toContain("visibility: hidden");
    expect(leftNav.attributes("style")).toContain("opacity: 0");
    expect(rightNav.isVisible()).toBe(true);
    expect(rightNav.attributes("style")).toContain("opacity: 1");

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 14,
    });
    await track.trigger("scroll");

    expect(leftNav.isVisible()).toBe(true);
    expect(leftNav.attributes("style")).toContain("opacity: 0.5");
    expect(rightNav.isVisible()).toBe(true);

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 186,
    });
    await track.trigger("scroll");

    expect(leftNav.isVisible()).toBe(true);
    expect(rightNav.attributes("style")).toContain("opacity: 0.5");

    Object.defineProperty(track.element, "scrollLeft", {
      configurable: true,
      value: 200,
    });
    await track.trigger("scroll");

    expect(rightNav.attributes("style")).toContain("visibility: hidden");
    expect(rightNav.attributes("style")).toContain("opacity: 0");
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
