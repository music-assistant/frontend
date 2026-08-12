// happy-dom resolves neither `inherit` nor the specificity of `html` against
// `*`, so the box model is only observable in the stylesheet itself
import css from "@/styles/global.css?inline";
import { describe, expect, it } from "vitest";

// Drop the comments so the prose explaining the rules cannot stand in for them.
const declarations = css.replace(/\/\*[\s\S]*?\*\//g, "");

describe("box model", () => {
  it("is declared by the app rather than borrowed from Vuetify", () => {
    expect(declarations).toMatch(/html\s*\{[^}]*box-sizing:\s*border-box/);
    expect(declarations).toMatch(
      /\*,\s*::before,\s*::after\s*\{[^}]*box-sizing:\s*inherit/,
    );
  });
});
