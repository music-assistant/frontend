/**
 * Reaches MediaSearch's results, which float in a portalled popover and so are
 * outside the mounted wrapper.
 */
export function searchResultButtons(): HTMLElement[] {
  return Array.from(
    document.querySelectorAll<HTMLElement>(".media-search-result"),
  );
}

/** The result row whose text contains `label`. */
export function searchResultButton(label: string): HTMLElement {
  const row = searchResultButtons().find((button) =>
    button.textContent?.includes(label),
  );
  if (!row) {
    throw new Error(
      `no search result matching "${label}"; found: ${searchResultButtons()
        .map((button) => button.textContent?.trim())
        .join(", ")}`,
    );
  }
  return row;
}
