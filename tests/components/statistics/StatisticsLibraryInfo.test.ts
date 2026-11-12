import StatisticsLibraryInfo from "@/components/statistics/StatisticsLibraryInfo.vue";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";

enableAutoUnmount(afterEach);

const explanation =
  "Includes plays linked to library tracks with album information. Other plays may be missing.";

describe("StatisticsLibraryInfo", () => {
  it("uses the explanation as the accessible label for the focusable info icon", () => {
    const wrapper = mount(StatisticsLibraryInfo, {
      props: { explanation },
    });
    const icon = wrapper.get('[role="img"]');

    expect(icon.attributes("tabindex")).toBe("0");
    expect(icon.attributes("aria-label")).toBe(explanation);
    expect(icon.get("svg").attributes("aria-hidden")).toBe("true");
    expect(wrapper.text()).not.toContain("Library-based");
  });

  it("shows the explanation on keyboard focus", async () => {
    const wrapper = mount(StatisticsLibraryInfo, {
      attachTo: document.body,
      props: { explanation },
    });

    (wrapper.get('[role="img"]').element as HTMLElement).focus();
    await flushPromises();
    await vi.waitFor(() => {
      expect(document.querySelector('[role="tooltip"]')?.textContent).toBe(
        explanation,
      );
    });
  });
});
