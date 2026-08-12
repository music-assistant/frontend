// happy-dom, the suite default, reports `inherit` verbatim and picks `*` over
// `html` for the root element, so the rules are asserted in the stylesheet
import css from "@/styles/global.css?inline";
import { describe, expect, it } from "vitest";

// Drop the comments so the prose explaining the rules cannot stand in for them.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("box model", () => {
  it("is declared by the app rather than borrowed from Vuetify", () => {
    // anchored, so a descendant selector ending in `html` cannot satisfy it
    expect(declarations).toMatch(
      /(^|[;}])\s*html\s*\{[^}]*box-sizing:\s*border-box/,
    );
    expect(declarations).toMatch(
      /\*,\s*::before,\s*::after\s*\{[^}]*box-sizing:\s*inherit/,
    );
  });
});
