// Internal factory helper — import only within this directory.
import { defineComponent, h } from "vue";
import type { Component, PropType } from "vue";

/** Render canonical shared SVG artwork inline while retaining its currentColor theming. */
export function makeSvgIcon(name: string, svg: string): Component {
  const rootMatch = svg.match(/^<svg\s+([^>]*)>([\s\S]*)<\/svg>\s*$/);
  if (!rootMatch) throw new Error(`Invalid SVG for shared icon "${name}"`);
  const rootAttributes = Object.fromEntries(
    [...rootMatch[1].matchAll(/([:\w-]+)="([^"]*)"/g)].map((match) => [
      match[1],
      match[2],
    ]),
  );
  delete rootAttributes.xmlns;
  delete rootAttributes.width;
  delete rootAttributes.height;
  const innerHtml = rootMatch[2]
    .replace(/<!--[\s\S]*?-->/g, "")
    .replace(/\s+/g, " ")
    .trim();

  return defineComponent({
    name,
    inheritAttrs: false,
    props: {
      size: {
        type: [Number, String] as PropType<number | string>,
        default: 24,
      },
    },
    setup(props, { attrs }) {
      return () =>
        h("svg", {
          ...rootAttributes,
          width: props.size,
          height: props.size,
          ...attrs,
          innerHTML: innerHtml,
        });
    },
  });
}
