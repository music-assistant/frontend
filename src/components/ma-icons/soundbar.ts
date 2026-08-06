import { h } from "vue";
import type { Component } from "vue";
import { makeStrokeIcon } from "./_make-icon";

/** Soundbar — 24×24. Drawn with a 1.5 stroke (overrides the factory default). */
export const Soundbar: Component = makeStrokeIcon(
  "soundbar",
  "0 0 24 24",
  h("rect", {
    x: "1.25",
    y: "6.75",
    width: "21.5",
    height: "10.5",
    rx: "2.5",
    "stroke-width": "1.5",
  }),
  h("circle", { cx: "6.75", cy: "12", r: "3", "stroke-width": "1.5" }),
  h("circle", { cx: "17.25", cy: "12", r: "3", "stroke-width": "1.5" }),
  h("rect", {
    x: "10.9",
    y: "10.2",
    width: "2.2",
    height: "3.6",
    rx: "1.1",
    fill: "currentColor",
    stroke: "none",
  }),
);
