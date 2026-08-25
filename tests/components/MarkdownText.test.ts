/**
 * @vitest-environment jsdom
 *
 * DOMPurify (used by the rendered markdown) needs a spec-complete DOM; the
 * suite's default happy-dom discards elements it should keep.
 */
import MarkdownText from "@/components/MarkdownText.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({ api: {} }));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

describe("MarkdownText", () => {
  it("renders markdown instead of showing its syntax", () => {
    const wrapper = mount(MarkdownText, { props: { text: "**bold**" } });

    expect(wrapper.find("strong").text()).toBe("bold");
    expect(wrapper.text()).not.toContain("*");
  });

  it("makes a link clickable and opens it in a new tab", () => {
    const wrapper = mount(MarkdownText, {
      props: { text: "see https://example.com/callback" },
    });

    const link = wrapper.find("a");
    expect(link.attributes("href")).toBe("https://example.com/callback");
    expect(link.attributes("target")).toBe("_blank");
  });

  it("renders nothing for empty text", () => {
    expect(mount(MarkdownText, { props: { text: null } }).text()).toBe("");
  });
});
