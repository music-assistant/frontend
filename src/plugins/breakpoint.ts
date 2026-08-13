import { App, reactive, toRefs, watch, Directive } from "vue";
import { IS_MOBILE_UA, IS_PHONE_UA, IS_TABLET_UA } from "@/helpers/device";

type MobileDeviceType = "mobile" | "phone" | "tablet";

type Breakpoints =
  | "bp0"
  | "bp1"
  | "bp2"
  | "bp3"
  | "bp4"
  | "bp5"
  | "bp6"
  | "bp7"
  | "bp8"
  | "bp9"
  | "bp10"
  | "bp11"
  | "bp12";

//TODO sorting
const breakpoints: { [key in Breakpoints]: number } = {
  bp0: 375,
  bp1: 500,
  bp2: 540,
  bp3: 575,
  bp4: 715,
  bp5: 800,
  bp6: 960,
  bp7: 1100,
  bp8: 1300,
  bp9: 1500,
  bp10: 1700,
  bp11: 1900,
  bp12: 415,
};

const state = reactive({
  width: window.innerWidth,
  height: window.innerHeight,
});

window.addEventListener("resize", () => {
  state.width = window.innerWidth;
  state.height = window.innerHeight;
});

/** Width up to which the screen is laid out for a phone. */
const PHONE_LAYOUT_WIDTH = 769;

/**
 * Height below which there is no room to lay out for a desktop whatever the
 * width. A phone on its side is what this catches: wide enough to pass for a
 * desktop, nowhere near tall enough to be one.
 */
const PHONE_LAYOUT_HEIGHT = 500;

/**
 * Whether the screen is phone-sized, by its own account or by either dimension.
 *
 * Reactive: reading this inside a computed re-runs it as the screen resizes or
 * turns.
 */
export const isPhoneSizedScreen = () =>
  IS_PHONE_UA ||
  state.width < PHONE_LAYOUT_WIDTH ||
  state.height < PHONE_LAYOUT_HEIGHT;

type Condition = "lt" | "gt";
type Key =
  | MobileDeviceType
  | Breakpoints
  | {
      breakpoint: Breakpoints | MobileDeviceType;
      condition?: Condition;
      offset?: number;
    };

export const getBreakpointValue = (key: Key): boolean => {
  let breakpoint: Breakpoints | MobileDeviceType = "bp1";
  let condition: Condition = "gt";
  let offset = 0;

  if (typeof key === "object") {
    breakpoint = key.breakpoint;
    condition = key.condition || "gt";
    offset = key.offset || 0;
  } else {
    breakpoint = key;
  }

  if (
    Object.values<MobileDeviceType>(["mobile", "phone", "tablet"]).includes(
      breakpoint as MobileDeviceType,
    )
  ) {
    if (typeof key === "object") condition = key.condition || "lt";
    switch (breakpoint) {
      case "mobile":
        return IS_MOBILE_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
      case "phone":
        return IS_PHONE_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
      case "tablet":
        return IS_TABLET_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
    }
  } else {
    return condition === "lt"
      ? state.width < breakpoints[breakpoint as Breakpoints] + offset
      : state.width >= breakpoints[breakpoint as Breakpoints] + offset;
  }
  return false;
};

const updateWidth = () => {
  state.width = window.innerWidth;
};

const vBreakpoint: Directive = {
  beforeMount(el, binding) {
    let condition: Condition = "gt";
    let breakpoint: Breakpoints | MobileDeviceType = "bp1";
    let offset = 0;

    if (typeof binding.value === "object") {
      condition = binding.value.condition;
      breakpoint = binding.value.breakpoint;
      offset = binding.value.offset || 0;
    } else {
      breakpoint = binding.value;
    }

    if (
      Object.values<MobileDeviceType>(["mobile", "phone", "tablet"]).includes(
        breakpoint as MobileDeviceType,
      )
    ) {
      condition = binding.value.condition || "lt";
    }

    const isMobileDevice = (device: MobileDeviceType) => {
      if (device === "mobile") {
        return IS_MOBILE_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
      }
      if (device === "phone") {
        return IS_PHONE_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
      }
      if (device === "tablet") {
        return IS_TABLET_UA
          ? true
          : condition === "lt"
            ? state.width < breakpoints["bp3"]
            : state.width >= breakpoints["bp3"];
      }
    };

    const updateVisibility = () => {
      if (
        Object.values<MobileDeviceType>(["mobile", "phone", "tablet"]).includes(
          breakpoint as MobileDeviceType,
        )
      ) {
        if (isMobileDevice(breakpoint as MobileDeviceType)) {
          el.style.display = "";
        } else {
          el.style.display = "none";
        }
      } else if (
        condition === "lt"
          ? state.width < breakpoints[breakpoint as Breakpoints] + offset
          : state.width >= breakpoints[breakpoint as Breakpoints] + offset
      ) {
        el.style.display = "";
      } else {
        el.style.display = "none";
      }
    };

    window.addEventListener("resize", updateWidth);
    watch(() => state.width, updateVisibility);
    updateVisibility();

    el._onDestroy = () => {
      window.removeEventListener("resize", updateWidth);
    };
  },
  unmounted(el) {
    el._onDestroy();
  },
};

const Breakpoint = {
  install(app: App) {
    app.config.globalProperties.$screenSize = toRefs(state);
    app.directive("breakpoint", vBreakpoint);
  },
};

export default Breakpoint;
