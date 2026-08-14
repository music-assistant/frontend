import { h } from "vue";
import type { Component } from "vue";
import { makeFillIcon } from "./_make-icon";

/** Home Assistant Voice Preview Edition silhouette (fill-based, 24×24). */
export const VoicePe: Component = makeFillIcon(
  "voice-pe",
  "0 0 24 24",
  h("path", {
    "fill-rule": "evenodd",
    "clip-rule": "evenodd",
    fill: "currentColor",
    d: "M6.5 3h11a3.5 3.5 0 0 1 3.5 3.5v11a3.5 3.5 0 0 1-3.5 3.5h-11A3.5 3.5 0 0 1 3 17.5v-11A3.5 3.5 0 0 1 6.5 3Zm5.5 2a7 7 0 1 0 0 14 7 7 0 0 0 0-14Zm0 1.8a5.2 5.2 0 1 0 0 10.4 5.2 5.2 0 0 0 0-10.4Zm0 2.6a2.6 2.6 0 1 0 0 5.2 2.6 2.6 0 0 0 0-5.2Z",
  }),
);
