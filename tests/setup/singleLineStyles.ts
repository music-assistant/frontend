/**
 * Puts style text on one line before happy-dom parses it.
 *
 * happy-dom 21 drops a declaration whose value spans several lines, which is
 * how Prettier wraps a long calc(), so those rules would silently go missing
 * from computed styles. Collapsing whitespace leaves the CSS meaning the same.
 */

if (navigator.userAgent.includes("HappyDOM")) {
  const textContent = Object.getOwnPropertyDescriptor(
    Element.prototype,
    "textContent",
  );
  if (textContent?.set && textContent.get) {
    const { get, set } = textContent;
    Object.defineProperty(HTMLStyleElement.prototype, "textContent", {
      configurable: true,
      get,
      set(this: HTMLStyleElement, value: string | null) {
        set.call(this, value?.replace(/\s+/g, " ") ?? value);
      },
    });
  }
}
