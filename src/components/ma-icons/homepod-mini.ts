import { h } from "vue";
import type { Component } from "vue";
import { makeFillIcon } from "./_make-icon";

// Source: 32×32 square — no padding needed.
const PATH =
  "M16 0C11.9611 0 9.49806 0.18946 6.49672 2.16466C2.32484 4.9102 0 9.9208 0 15.5162C0 24.4986 6.45056 32 14.6622 32H17.3378C25.5494 32 32 24.4986 32 15.5162C32 9.9296 29.6826 4.92616 25.5232 2.17774C22.5176 0.19178 20.039 0 16 0ZM8.11086 3.51274C10.3659 2.17222 12.3158 2 16 2C19.6802 2 21.6418 2.17386 23.898 3.51786C21.483 4.93226 18.8138 5.5 16 5.5C13.183 5.5 10.5257 4.93184 8.11086 3.51274ZM6.36416 4.77902C3.6115 7.2148 2 11.0744 2 15.5162C2 23.6366 7.78302 30 14.6622 30H17.3378C24.217 30 30 23.6366 30 15.5162C30 11.0788 28.3916 7.2222 25.6438 4.78606L25.5458 4.84986C22.594 6.77278 19.3288 7.5 16 7.5C12.6622 7.5 9.40794 6.76992 6.4526 4.83688L6.36416 4.77902Z";

/** HomePod mini – Apple's near-spherical smart speaker silhouette (fill-based, 32×32). */
export const HomepodMini: Component = makeFillIcon(
  "HomepodMini",
  "0 0 32 32",
  h("path", {
    "fill-rule": "evenodd",
    "clip-rule": "evenodd",
    d: PATH,
    fill: "currentColor",
  }),
);
