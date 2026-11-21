/**
 * @vitest-environment jsdom
 *
 * DOMPurify needs a spec-complete DOM: under the suite's default happy-dom it
 * discards elements it should keep (lists, the leading paragraph), which would
 * make every assertion below meaningless.
 */
import {
  isEmbeddedImage,
  markdownToHtml,
  providerMarkdownToHtml,
} from "@/helpers/utils";
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

describe("providerMarkdownToHtml", () => {
  // every way a sanitized fragment could still load an image from a remote address
  it.each([
    ["a markdown image", "![logo](https://example.com/a.png)"],
    ["an img tag", '<img src="https://example.com/a.png">'],
    ["a video poster", '<video poster="https://example.com/p.png"></video>'],
    ["an audio source", '<audio src="https://example.com/a.mp3"></audio>'],
    [
      "a picture source",
      '<picture><source srcset="https://example.com/s.png"></picture>',
    ],
    ["an image input", '<input type="image" src="https://example.com/i.png">'],
    ["an svg image", '<svg><image href="https://example.com/i.png"/></svg>'],
    [
      "an svg filter image",
      '<svg><feImage href="https://example.com/i.png"/></svg>',
    ],
    [
      "an inline style",
      '<span style="background:url(https://example.com/s.png)">x</span>',
    ],
    [
      "a cell background",
      '<table><tr><td background="https://example.com/b.png">x</td></tr></table>',
    ],
  ])("drops %s", (_kind, source) => {
    expect(providerMarkdownToHtml(source)).not.toContain("example.com");
  });

  it("keeps images where markdownToHtml is used", () => {
    expect(markdownToHtml("![logo](https://example.com/a.png)")).toContain(
      '<img src="https://example.com/a.png"',
    );
  });

  it("keeps the rest of the markdown, links included", () => {
    const html = providerMarkdownToHtml(
      "**bold** and [a link](https://example.com/docs)",
    );
    expect(html).toContain("<strong>bold</strong>");
    expect(html).toContain('href="https://example.com/docs"');
    expect(html).toContain('target="_blank"');
  });
});

describe.each([
  ["markdownToHtml", markdownToHtml],
  ["providerMarkdownToHtml", providerMarkdownToHtml],
])("%s", (_name, render) => {
  it("leaves out a style block after a paragraph", () => {
    const html = render("Intro\n\n<style>p { color: red; }</style>");

    expect(html).toContain("<p>Intro</p>");
    expect(html).not.toContain("<style");
    expect(html).not.toContain("color: red");
  });

  it("leaves out a form and its fields after a paragraph", () => {
    const html = render(
      "Intro\n\n<form><input name=a><textarea>t</textarea>" +
        "<select><optgroup><option>o</option></optgroup></select>" +
        "<button>Go</button></form>",
    );

    expect(html).toContain("<p>Intro</p>");
    expect(html).not.toMatch(
      /<(form|input|textarea|select|optgroup|option|button)\b/,
    );
  });
});

describe("isEmbeddedImage", () => {
  it.each([
    ["data:image/png;base64,iVBORw0KGgo=", true],
    ["data:image/svg+xml;base64,PHN2Zz4=", true],
    ["https://example.com/qr.png", false],
    ["data:text/html,<p>x</p>", false],
    ["", false],
    [null, false],
  ])("judges %s as %s", (src, embedded) => {
    expect(isEmbeddedImage(src)).toBe(embedded);
  });
});
