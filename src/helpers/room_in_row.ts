/**
 * The width an element may take in its flex row: the row's content width less
 * the other shown items, their margins and the gaps beside them.
 */
export function roomInRow(element: HTMLElement): number {
  const row = element.parentElement;
  if (!row) return Infinity;
  const style = getComputedStyle(row);
  const gap = parseFloat(style.columnGap) || 0;
  const padding =
    (parseFloat(style.paddingLeft) || 0) +
    (parseFloat(style.paddingRight) || 0);
  // an item that isn't rendered takes no room, nor a gap
  const others = [...row.children].filter(
    (child) => child !== element && child.getBoundingClientRect().width > 0,
  );
  const othersWidth = others.reduce((total, child) => {
    const childStyle = getComputedStyle(child);
    return (
      total +
      child.getBoundingClientRect().width +
      (parseFloat(childStyle.marginLeft) || 0) +
      (parseFloat(childStyle.marginRight) || 0)
    );
  }, 0);
  return row.clientWidth - padding - othersWidth - gap * others.length;
}
