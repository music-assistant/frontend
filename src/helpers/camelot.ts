/**
 * The colour of a Camelot code (e.g. "11A") on the Camelot wheel: each wheel
 * number has its own hue, going round the colour circle from teal at 1, and the
 * minor (A) ring is a softer shade of the major (B) one. Undefined for anything
 * that is not a Camelot code.
 */
export function camelotColor(code: string | null | undefined) {
  const match = /^(1[0-2]|[1-9])([AB])$/.exec(code ?? "");
  if (!match) return undefined;
  const hue = (170 - (Number(match[1]) - 1) * 30 + 360) % 360;
  const saturation = match[2] === "B" ? 75 : 55;
  return `hsl(${hue} ${saturation}% 62%)`;
}
