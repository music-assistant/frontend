/**
 * @vitest-environment jsdom
 *
 * DOMPurify needs a spec-complete DOM: under the suite's default happy-dom it
 * discards elements it should keep (lists, the leading paragraph), which would
 * make every assertion below meaningless.
 */
import { markdownToHtml } from "@/helpers/utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/api", () => ({ api: {} }));

vi.mock("@/plugins/breakpoint", () => ({
  getBreakpointValue: vi.fn(() => false),
}));

describe("markdownToHtml", () => {
  it("neutralizes an onerror image payload", () => {
    const html = markdownToHtml('<img src=x onerror="alert(1)">');
    expect(html).not.toContain("onerror");
  });

  it("strips script tags", () => {
    const html = markdownToHtml("<script>alert(1)</script>");
    expect(html).not.toContain("<script>");
  });

  it("drops a javascript: link", () => {
    expect(markdownToHtml("[x](javascript:alert(1))")).not.toContain(
      "javascript:",
    );
  });

  it("renders legitimate markdown", () => {
    expect(markdownToHtml("**bold**")).toContain("<strong>bold</strong>");
    expect(markdownToHtml("*italic*")).toContain("<em>italic</em>");
    expect(markdownToHtml("[link](https://example.com)")).toContain(
      'href="https://example.com"',
    );
  });

  it("converts line breaks", () => {
    expect(markdownToHtml("line1\nline2")).toContain("<br>");
  });

  it("treats escaped newlines as real ones", () => {
    expect(markdownToHtml("line1\\nline2")).toContain("<br>");
    expect(markdownToHtml("- one\\n- two")).toContain("<li>two</li>");
  });

  it("renders numbered and bulleted lists", () => {
    const ordered = markdownToHtml("1. first\n2. second");
    expect(ordered).toContain("<ol>");
    expect(ordered).toContain("<li>second</li>");
    expect(markdownToHtml("- one\n- two")).toContain("<ul>");
  });

  it("keeps blank-line separated text in separate paragraphs", () => {
    const html = markdownToHtml("first\n\nsecond");
    expect(html).toContain("<p>first</p>");
    expect(html).toContain("<p>second</p>");
  });

  it("opens links in a new tab without leaking the opener", () => {
    const html = markdownToHtml("[link](https://example.com)");
    expect(html).toContain('target="_blank"');
    expect(html).toContain('rel="noopener noreferrer"');
  });

  it("links a bare url so it can be opened and copied", () => {
    expect(markdownToHtml("go to https://example.com/callback")).toContain(
      'href="https://example.com/callback"',
    );
  });
});
