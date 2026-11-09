import StatisticsLibraryInfo from "@/components/statistics/StatisticsLibraryInfo.vue";
import { i18n } from "@/plugins/i18n";
import { enableAutoUnmount, flushPromises, mount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;
const explanation =
  "Includes plays linked to library tracks with album information. Other plays may be missing.";

beforeEach(() => {
  i18n.global.locale.value = "en_GB";
});

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

function mountInfo() {
  return mount(StatisticsLibraryInfo, {
    attachTo: document.body,
    props: { statistic: "Top albums", explanation },
  });
}

describe("StatisticsLibraryInfo", () => {
  it("uses a named, focusable button without requiring hover", () => {
    const wrapper = mountInfo();
    const button = wrapper.get("button");

    expect(button.text()).toBe("Library-based");
    expect(button.attributes("type")).toBe("button");
    expect(button.attributes("aria-label")).toBe(
      "Top albums: about library-based statistics",
    );
    expect(button.attributes("aria-haspopup")).toBe("dialog");
    expect(button.attributes("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("opens on click/tap and closes when the trigger is activated again", async () => {
    const wrapper = mountInfo();
    const button = wrapper.get("button");

    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-expanded")).toBe("true");
    const dialog = document.querySelector('[role="dialog"]');
    expect(dialog?.textContent).toBe(explanation);
    expect(dialog?.getAttribute("aria-label")).toBe(
      button.attributes("aria-label"),
    );
    expect(dialog?.id).toBe(button.attributes("aria-controls"));
    expect(dialog?.classList.contains("max-w-[calc(100vw-24px)]")).toBe(true);

    await button.trigger("click");
    await flushPromises();

    expect(button.attributes("aria-expanded")).toBe("false");
    expect(document.querySelector('[role="dialog"]')).toBeNull();
  });

  it("dismisses with Escape and returns focus to its trigger", async () => {
    const wrapper = mountInfo();
    const button = wrapper.get("button");
    button.element.focus();
    await button.trigger("click");
    await flushPromises();

    await vi.waitFor(() => {
      expect(
        document.activeElement?.contains(
          document.querySelector('[role="dialog"]'),
        ),
      ).toBe(true);
    });
    document.activeElement?.dispatchEvent(
      new KeyboardEvent("keydown", { key: "Escape", bubbles: true }),
    );
    await flushPromises();

    await vi.waitFor(() => {
      expect(button.attributes("aria-expanded")).toBe("false");
      expect(document.activeElement).toBe(button.element);
    });
  });
});
