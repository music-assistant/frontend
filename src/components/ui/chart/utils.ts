import type { ChartConfig } from ".";
import { isClient } from "@vueuse/core";
import { useId } from "reka-ui";
import { h, render } from "vue";

// rendered tooltips, kept for reuse; past this many the oldest are dropped so
// the cache stays bounded however often charts mount
const MAX_CACHED_TOOLTIPS = 200;
const cache = new Map<string, string>();

// Convert object to a consistent string key
function serializeKey(key: Record<string, unknown>): string {
  return JSON.stringify(key, Object.keys(key).sort());
}

function remember(key: string, content: string): void {
  cache.set(key, content);
  if (cache.size > MAX_CACHED_TOOLTIPS) {
    const oldest = cache.keys().next().value;
    if (oldest !== undefined) cache.delete(oldest);
  }
}

interface Constructor<P = unknown> {
  __isFragment?: never;
  __isTeleport?: never;
  __isSuspense?: never;
  new (...args: never[]): {
    $props: P;
  };
}

/**
 * A Unovis tooltip template that renders `component` to HTML. `config` and
 * `props` may be getters, read on every render, for values that change after
 * mount such as translated labels and the locale.
 */
export function componentToString<P>(
  config: ChartConfig | (() => ChartConfig),
  component: Constructor<P>,
  props?: P | (() => P),
) {
  if (!isClient) return;

  // This function will be called once during mount lifecycle
  const id = useId();

  // https://unovis.dev/docs/auxiliary/Crosshair#component-props
  return (_data: Record<string, unknown>, x: number | Date) => {
    const data = ("data" in _data ? _data.data : _data) as Record<
      string,
      unknown
    >;
    const resolvedConfig = typeof config === "function" ? config() : config;
    const resolvedProps =
      typeof props === "function" ? (props as () => P)() : props;
    // the labels are part of the key, so a change of language renders anew
    const labels = Object.values(resolvedConfig)
      .map((entry) => entry.label)
      .join("|");
    const serializedKey = `${id}-${labels}-${serializeKey({
      ...(resolvedProps as Record<string, unknown>),
      ...data,
    })}`;
    const cachedContent = cache.get(serializedKey);
    if (cachedContent) return cachedContent;

    const vnode = h<unknown>(component, {
      ...resolvedProps,
      payload: data,
      config: resolvedConfig,
      x,
    });
    const div = document.createElement("div");
    render(vnode, div);
    remember(serializedKey, div.innerHTML);
    return div.innerHTML;
  };
}
