import {
  h,
  inject,
  provide,
  ref,
  type InjectionKey,
  type SetupContext,
} from "vue";

// reka-ui owns the open state, so the stub owns it too and reports every change
// the way the real menu does. Its dismiss button stands in for everything that
// closes the menu without touching the trigger: an outside tap, escape, or
// picking an entry.
const dropdownToggleKey: InjectionKey<() => void> = Symbol();

const DropdownMenuStub = {
  emits: ["update:open"],
  setup(_: unknown, { emit, slots }: SetupContext<["update:open"]>) {
    const open = ref(false);
    const setOpen = (value: boolean) => {
      open.value = value;
      emit("update:open", value);
    };
    provide(dropdownToggleKey, () => setOpen(!open.value));
    return () =>
      h("div", { class: "dropdown", "data-open": String(open.value) }, [
        h("button", {
          class: "dropdown-dismiss",
          onClick: () => setOpen(false),
        }),
        slots.default?.(),
      ]);
  },
};

const DropdownMenuTriggerStub = {
  setup(_: unknown, { slots }: SetupContext) {
    const toggle = inject(dropdownToggleKey);
    if (!toggle)
      throw new Error("DropdownMenuTrigger must be inside DropdownMenu");
    // reka's own handler sits on the trigger itself, so a trigger that stops
    // the click from reaching its surroundings still opens the menu: the
    // capture phase stands in for that
    return () => h("div", { onClickCapture: toggle }, slots.default?.());
  },
};

// reka only renders its content while the menu holds it open, which its own
// context decides - these keep the entries reachable without it
const DropdownMenuContentStub = {
  setup(_: unknown, { slots }: SetupContext) {
    return () => h("div", { class: "dropdown-content" }, slots.default?.());
  },
};

const DropdownMenuItemStub = {
  setup(_: unknown, { attrs, slots }: SetupContext) {
    return () =>
      h("button", { ...attrs, class: "dropdown-item" }, slots.default?.());
  },
};

/**
 * Stubs that keep a dropdown's trigger and entries reachable without reka-ui,
 * for the tests that drive a menu rather than the component that owns it.
 */
export const dropdownMenuStubs = {
  DropdownMenu: DropdownMenuStub,
  DropdownMenuTrigger: DropdownMenuTriggerStub,
  DropdownMenuContent: DropdownMenuContentStub,
  DropdownMenuItem: DropdownMenuItemStub,
};
