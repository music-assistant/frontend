import type { Component } from "vue";
import { h } from "vue";
import { makeFillIcon } from "./_make-icon";

export const Wiim: Component = makeFillIcon(
  "wiim",
  "2 2 20 20",
  h("path", {
    "fill-rule": "evenodd",
    "clip-rule": "evenodd",
    fill: "currentColor",
    d: "M8.5 3h7a3.5 3.5 0 0 1 3.5 3.5v11a3.5 3.5 0 0 1-3.5 3.5h-7A3.5 3.5 0 0 1 5 17.5v-11A3.5 3.5 0 0 1 8.5 3Zm3.5 2.6a3 3 0 1 0 0 6 3 3 0 0 0 0-6Z",
  }),
);
