// Internal factory helpers — import only within this directory.
import { h } from "vue";
import type { Component } from "vue";

/** Stroke-based icon (Lucide style). viewBox defaults to 24×24; supply a custom square viewBox for other coordinate spaces. */
export function makeStrokeIcon(
  name: string,
  viewBox = "0 0 24 24",
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
            stroke: "currentColor",
            "stroke-width": "2",
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
