import { h } from "vue";
import type { Component } from "vue";
import { makeStrokeIcon } from "./_make-icon";

export const GroupedPlayers: Component = makeStrokeIcon(
  "grouped-players",
  "0 0 24 24",
  h("path", {
    d: "M8 6V4a2 2 0 0 1 2-2h8a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2h-2",
  }),
  h("path", { d: "M11 5h3" }),
  h("rect", { x: "4", y: "6", width: "12", height: "16", rx: "2" }),
  h("circle", { cx: "10", cy: "10", r: "1" }),
  h("circle", { cx: "10", cy: "16", r: "3" }),
  h("circle", {
    cx: "10",
    cy: "16",
    r: "0.65",
    fill: "currentColor",
    stroke: "none",
  }),
);
