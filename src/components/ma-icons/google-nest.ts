import { h } from "vue";
import type { Component } from "vue";
import { makeFillIcon } from "./_make-icon";

/** Google Nest speaker silhouette (fill-based, 24×24). */
export const GoogleNest: Component = makeFillIcon(
  "google-nest",
  "0 0 24 24",
  h("path", {
    "fill-rule": "evenodd",
    "clip-rule": "evenodd",
    fill: "currentColor",
    d: "M12 3.2a8.8 8.8 0 1 1 0 17.6 8.8 8.8 0 0 1 0-17.6Zm-4.6 7.75a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm2.9 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm3.4 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Zm2.9 0a1.05 1.05 0 1 0 0 2.1 1.05 1.05 0 0 0 0-2.1Z",
  }),
);
