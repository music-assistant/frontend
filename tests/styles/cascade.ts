/**
 * Helpers for the tests that assert which of two competing CSS rules wins.
 *
 * Reading the winner back off getComputedStyle does not stand in for the
 * shipped cascade here: the raw source these tests inject carries no scope
 * hash, and happy-dom never expands an inset shorthand, so the competing rules
 * are weighed by ranking their selectors instead.
 */

/**
 * The compound Vue's compiler adds to every selector in a scoped block.
 *
 * The raw source these tests read carries no [data-v-hash], so a selector that
 * ships scoped has to be credited with it by hand before the ranks compare.
 */
export const SCOPE_COMPOUND = 1;

/**
 * The contents of every `<style>` block in a component's source, in the order
 * it declares them.
 *
 * vitest only compiles the stylesheets under src/styles, so a component's own
 * rules have to be lifted straight out of its source to be asserted on.
 */
export function styleBlocks(source: string) {
  return [...source.matchAll(/<style[^>]*>([\s\S]*?)<\/style>/g)].map(
    (match) => match[1],
  );
}

/**
 * The selectors in `styles` that set `property` and land on `element`.
 *
 * A rule may carry a selector list, of which only some parts reach the element,
 * so the parts are returned one by one rather than as the whole selector text.
 */
export function selectorsSetting(
  styles: HTMLStyleElement,
  element: Element,
  property: string,
) {
  return [...(styles.sheet?.cssRules ?? [])]
    .filter((rule): rule is CSSStyleRule => rule instanceof CSSStyleRule)
    .filter((rule) => rule.style.getPropertyValue(property) !== "")
    .flatMap((rule) => rule.selectorText.split(","))
    .map((selector) => selector.trim())
    .filter((selector) => element.matches(selector));
}

/**
 * How specific `selector` is, counted in class-level compounds.
 *
 * Comparable only between selectors that carry no id and no element name, which
 * is what every caller weighs against each other.
 */
export function rank(selector: string) {
  // :where() is what global.css reaches for to contribute no specificity at
  // all, so it drops out before anything is counted
  return (
    selector
      .replace(/:where\([^)]*\)/g, "")
      .match(/\.[\w-]+|\[[^\]]+\]|:[\w-]+/g) ?? []
  ).length;
}
