// Internal factory helpers — import only within this directory.
import { h } from "vue";
import type { Component } from "vue";

/** Stroke-based icon (Lucide style). viewBox defaults to 24×24; supply a custom square viewBox for other coordinate spaces. The strokeWidth prop is always in 24-unit (Lucide) terms — it is rescaled internally for larger coordinate spaces, which would otherwise render visibly thinner strokes at the same size. */
export function makeStrokeIcon(
  name: string,
  viewBox = "0 0 24 24",
  ...children: ReturnType<typeof h>[]
): Component {
  const strokeScale = (Number(viewBox.split(" ")[3]) || 24) / 24;
  return {
    name,
    props: {
      size: { type: [Number, String], default: 24 },
      strokeWidth: { type: [Number, String], default: 2 },
    },
    setup(props: { size?: number | string; strokeWidth?: number | string }) {
      return () =>
        h(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: props.size ?? 24,
            height: props.size ?? 24,
            viewBox,
            fill: "none",
            stroke: "currentColor",
            "stroke-width": Number(props.strokeWidth ?? 2) * strokeScale,
            "stroke-linecap": "round",
            "stroke-linejoin": "round",
          },
          children,
        );
    },
  };
}

/** Fill-based icon. viewBox must be square — pad non-square artwork horizontally before passing in. */
export function makeFillIcon(
  name: string,
  viewBox: string,
  ...children: ReturnType<typeof h>[]
): Component {
  return {
    name,
    props: { size: { type: [Number, String], default: 24 } },
    setup(props: { size?: number | string }) {
      return () =>
        h(
          "svg",
          {
            xmlns: "http://www.w3.org/2000/svg",
            width: props.size ?? 24,
            height: props.size ?? 24,
            viewBox,
            fill: "none",
            stroke: "none",
          },
          children,
        );
    },
  };
}
