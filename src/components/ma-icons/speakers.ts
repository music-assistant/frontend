import { h } from "vue";
import type { Component } from "vue";
import { makeStrokeIcon } from "./_make-icon";

/** Speaker pair / group — Lucide-style, 24×24. */
export const Speakers: Component = makeStrokeIcon(
  "speakers",
  "0 0 24 24",
  h("rect", { x: "2", y: "3", width: "9", height: "18", rx: "2" }),
  h("rect", { x: "13", y: "3", width: "9", height: "18", rx: "2" }),
  h("path", { d: "M6.5 7.5h.01" }),
  h("path", { d: "M17.5 7.5h.01" }),
  h("circle", { cx: "6.5", cy: "14.5", r: "2.5" }),
  h("circle", { cx: "17.5", cy: "14.5", r: "2.5" }),
);
