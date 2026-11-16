import { useEscapeBack } from "@/composables/useEscapeBack";
import { store } from "@/plugins/store";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it, vi } from "vitest";
import { h, ref } from "vue";

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
