import { h } from "vue";
import type { Component } from "vue";
import { makeStrokeIcon } from "./_make-icon";

/** Apple TV icon — 30×30 coordinate space. */
export const AppleTv: Component = makeStrokeIcon(
  "apple-tv",
  "0 0 30 30",
  h("path", {
    d: "M8.75 26.25H21.25M5 3.75H25C26.3807 3.75 27.5 4.86929 27.5 6.25V18.75C27.5 20.1307 26.3807 21.25 25 21.25H5C3.61929 21.25 2.5 20.1307 2.5 18.75V6.25C2.5 4.86929 3.61929 3.75 5 3.75Z",
  }),
);
