import { describe, expect, it, vi } from "vitest";

vi.mock("@/components/MarkdownText.vue", () => ({
  default: {
    name: "MarkdownText",
    props: ["text"],
    template: '<div class="markdown-stub">{{ text }}</div>',
  },
}));

import DetailTextRow from "@/components/details/DetailTextRow.vue";
import { flushPromises, mount } from "@vue/test-utils";

function mountRow(props: Record<string, unknown> = {}) {
  return mount(DetailTextRow, {
    props: { dialogTitle: "An item", ...props },
    global: {
      mocks: { $t: (key: string) => key },
      // the long-press directive is registered by a plugin the test skips
      directives: { hold: {} },
      stubs: {
        Dialog: { template: "<div><slot /></div>" },
        DialogContent: { template: "<div><slot /></div>" },
        DialogFooter: { template: "<div><slot /></div>" },
        DialogHeader: { template: "<div><slot /></div>" },
        DialogTitle: { template: "<div><slot /></div>" },
        Button: { template: "<button><slot /></button>" },
        Skeleton: { template: '<div class="skeleton" />' },
      },
    },
  });
}

describe("DetailTextRow", () => {
  it("stands a skeleton in while the text is on its way", () => {
    const wrapper = mountRow();

    expect(wrapper.findAll(".skeleton").length).toBeGreaterThan(0);
    expect(wrapper.find(".detail-text__body").exists()).toBe(false);
  });

  it("prints plain text as it was written", () => {
    const wrapper = mountRow({ text: "One\nTwo" });

    const body = wrapper.find(".detail-text__body");
    expect(body.text()).toContain("One");
    expect(body.classes()).toContain("detail-text__body--verbatim");
    expect(wrapper.find(".markdown-stub").exists()).toBe(false);
  });

  it("renders a markdown text as markdown", () => {
    const wrapper = mountRow({ text: "**Bold**", markdown: true });

    expect(wrapper.find(".markdown-stub").text()).toBe("**Bold**");
  });

  // the lyrics show more before the fold than a biography does
  it("clamps to the lines it was given, one more on phone", () => {
    const style = mountRow({ text: "Lyrics", lines: 4 })
      .find(".detail-text")
      .attributes("style");

    expect(style).toContain("--detail-text-lines: 4");
    expect(style).toContain("--detail-text-phone-lines: 5");
  });

  it("opens the whole text from the text itself", async () => {
    const wrapper = mountRow({ text: "One\nTwo" });

    await wrapper.find(".detail-text__body").trigger("click");
    await flushPromises();

    expect(wrapper.find(".detail-text__full").exists()).toBe(true);
  });

  it("has a heading only when it was given one", () => {
    expect(mountRow({ text: "A" }).find(".detail-text__title").exists()).toBe(
      false,
    );
    expect(
      mountRow({ text: "A", title: "Lyrics" })
        .find(".detail-text__title")
        .text(),
    ).toBe("Lyrics");
  });
});
