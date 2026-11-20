import { Select, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useEscapeBack } from "@/composables/useEscapeBack";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, ref, type VNode } from "vue";
import { createVuetify } from "vuetify";
import { VAutocomplete, VSelect } from "vuetify/components";

vi.mock("@/plugins/store", () => ({
  store: {
    dialogActive: false,
    showPlayersMenu: false,
    showFullscreenPlayer: false,
  },
}));
enableAutoUnmount(afterEach);
afterEach(() => {
  document.body.replaceChildren();
  store.dialogActive = false;
  store.showPlayersMenu = false;
  store.showFullscreenPlayer = false;
});

function escape(
  target: EventTarget = document.body,
  init: KeyboardEventInit = {},
) {
  const event = new KeyboardEvent("keydown", {
    key: "Escape",
    bubbles: true,
    cancelable: true,
    ...init,
  });
  target.dispatchEvent(event);
  return event;
}
function harness(enabled = () => true) {
  const back = vi.fn();
  const component = {
    setup() {
      useEscapeBack(back, enabled);
      return () => h("button", "back");
    },
  };
  return { back, component, wrapper: mount(component) };
}
/** Mounts `field` on the page and presses Escape on what then has focus. */
function escapeFrom(field: () => VNode, focusSelector: string) {
  const back = vi.fn();
  mount(
    {
      setup() {
        useEscapeBack(back);
        return field;
      },
    },
    { attachTo: document.body, global: { plugins: [createVuetify()] } },
  );
  const focused = document.querySelector<HTMLElement>(focusSelector)!;
  focused.focus();
  expect(document.activeElement).toBe(focused);
  // no list is open, so only the field itself can claim Escape
  expect(document.querySelector('.v-overlay--active, [role="listbox"]')).toBe(
    null,
  );
  escape(focused);
  return back;
}

describe("useEscapeBack", () => {
  it("navigates once, prevents default, and stops listening after unmount", () => {
    const { back, wrapper } = harness();
    expect(escape().defaultPrevented).toBe(true);
    expect(back).toHaveBeenCalledTimes(1);
    wrapper.unmount();
    expect(escape().defaultPrevented).toBe(false);
    expect(back).toHaveBeenCalledTimes(1);
  });

  it.each([{ key: "Enter" }, { repeat: true }])("ignores %j", (init) => {
    const { back } = harness();
    expect(escape(document.body, init).defaultPrevented).toBe(false);
    expect(back).not.toHaveBeenCalled();
  });

  it("uses the live enabled guard", () => {
    const enabled = ref(false);
    const { back } = harness(() => enabled.value);
    escape();
    expect(back).not.toHaveBeenCalled();
    enabled.value = true;
    escape();
    expect(back).toHaveBeenCalledOnce();
  });

  it.each([
    "input",
    "textarea",
    "select",
    'div contenteditable=""',
    'div contenteditable="plaintext-only"',
  ])("protects editable %s and descendants", (markup) => {
    const { back } = harness();
    document.body.innerHTML = `<${markup}><span></span></${markup.split(" ")[0]}>`;
    const target = document.body.firstElementChild!;
    escape(target.querySelector("span") ?? target);
    expect(back).not.toHaveBeenCalled();
  });

  it("goes back from a select whose list is closed, as after picking from it", () => {
    const back = escapeFrom(
      () => h(VSelect, { items: ["A", "B"], modelValue: "B" }),
      ".v-select input",
    );
    expect(back).toHaveBeenCalledOnce();
  });

  it("goes back from a reka select whose list is closed", () => {
    const back = escapeFrom(
      () =>
        h(Select, { modelValue: "b" }, () =>
          h(SelectTrigger, () => h(SelectValue)),
        ),
      '[data-slot="select-trigger"]',
    );
    expect(back).toHaveBeenCalledOnce();
  });

  it("leaves Escape to an autocomplete, which takes typing", () => {
    const back = escapeFrom(
      () => h(VAutocomplete, { items: ["A", "B"] }),
      ".v-autocomplete input",
    );
    expect(back).not.toHaveBeenCalled();
  });

  it.each([
    'role="dialog"',
    'role="alertdialog"',
    'role="menu"',
    'role="listbox"',
    'data-slot="popover-content" data-state="open"',
    'class="v-overlay--active"',
  ])(
    "protects active overlay %s, including synchronous dismissal",
    (attributes) => {
      const { back } = harness();
      document.body.innerHTML = `<div ${attributes}></div>`;
      document.addEventListener(
        "keydown",
        () => document.body.replaceChildren(),
        { once: true },
      );
      escape();
      expect(back).not.toHaveBeenCalled();
      escape();
      expect(back).toHaveBeenCalledOnce();
    },
  );

  it.each([
    "hidden",
    'aria-hidden="true"',
    'data-state="closed"',
    'style="display: none"',
  ])("ignores hidden overlay ancestor %s", (attributes) => {
    const { back } = harness();
    document.body.innerHTML = `<div ${attributes}><div role="dialog"></div></div>`;
    escape();
    expect(back).toHaveBeenCalledOnce();
  });

  it.each(["dialogActive", "showPlayersMenu", "showFullscreenPlayer"] as const)(
    "protects %s even if cleared during dispatch",
    (key) => {
      const { back } = harness();
      store[key] = true;
      document.addEventListener(
        "keydown",
        () => {
          store[key] = false;
        },
        { once: true },
      );
      escape();
      expect(back).not.toHaveBeenCalled();
    },
  );

  it.each(["preventDefault", "stopPropagation"] as const)(
    "lets document handlers %s before navigation",
    (method) => {
      const { back } = harness();
      document.addEventListener("keydown", (event) => event[method](), {
        once: true,
      });
      escape();
      expect(back).not.toHaveBeenCalled();
    },
  );
});
