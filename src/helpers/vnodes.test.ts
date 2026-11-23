import { describe, expect, it } from "vitest";
import { Comment, createCommentVNode, createTextVNode, Fragment, h } from "vue";
import { hasVNodeContent } from "./vnodes";

describe("hasVNodeContent", () => {
  it("finds nothing in no nodes", () => {
    expect(hasVNodeContent([])).toBe(false);
  });

  it("finds nothing in content left out by a v-if", () => {
    expect(hasVNodeContent([createCommentVNode("v-if", true)])).toBe(false);
    expect(hasVNodeContent([h(Comment, "v-if")])).toBe(false);
  });

  it("finds nothing in white space", () => {
    expect(hasVNodeContent([createTextVNode("  ")])).toBe(false);
  });

  it.each([
    ["an element", h("span")],
    ["a component", h({ render: () => null })],
    ["text", createTextVNode("On")],
  ])("finds %s", (_name, node) => {
    expect(hasVNodeContent([createCommentVNode("v-if", true), node])).toBe(
      true,
    );
  });

  it("looks into fragments", () => {
    expect(
      hasVNodeContent([h(Fragment, [createCommentVNode("v-if", true)])]),
    ).toBe(false);
    expect(hasVNodeContent([h(Fragment, [h("span")])])).toBe(true);
  });
});
