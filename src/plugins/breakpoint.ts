import { App, reactive, toRefs, watch, Directive } from 'vue';
import MobileDetect from 'mobile-detect';

type MobileDeviceType = 'mobile' | 'phone' | 'tablet';
const md = new MobileDetect(window.navigator.userAgent);

type Breakpoints =
  | 'bp0'
  | 'bp1'
  | 'bp2'
  | 'bp3'
  | 'bp4'
  | 'bp5'
  | 'bp6'
  | 'bp7'
  | 'bp8'
  | 'bp9'
  | 'bp10'
  | 'bp11';

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
  bp8: 1500,
  bp9: 1700,
  bp10: 1900,
  bp11: 415,
};

const state = reactive({ width: window.innerWidth });

window.addEventListener('resize', () => {
  state.width = window.innerWidth;
});

type Condition = 'lt' | 'gt';
type Key =
  | MobileDeviceType
  | Breakpoints
  | {
      breakpoint: Breakpoints | MobileDeviceType;
      condition?: Condition;
      offset?: number;
    };

export const getBreakpointValue = (key: Key): boolean => {
  let breakpoint: Breakpoints | MobileDeviceType = 'bp1';
  let condition: Condition = 'gt';
  let offset = 0;

  if (typeof key === 'object') {
    breakpoint = key.breakpoint;
    condition = key.condition || 'gt';
    offset = key.offset || 0;
  } else {
    breakpoint = key;
  }

  if (
    Object.values<MobileDeviceType>(['mobile', 'phone', 'tablet']).includes(
      breakpoint as MobileDeviceType,
    )
  ) {
    if (typeof key === 'object') condition = key.condition || 'lt';
    switch (breakpoint) {
      case 'mobile':
        return md.mobile()
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
      case 'phone':
        return md.phone()
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
      case 'tablet':
        return md.tablet()
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
    }
  } else {
    return condition === 'lt'
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
    let condition: Condition = 'gt';
    let breakpoint: Breakpoints | MobileDeviceType = 'bp1';
    let offset = 0;

    if (typeof binding.value === 'object') {
      condition = binding.value.condition;
      breakpoint = binding.value.breakpoint;
      offset = binding.value.offset || 0;
    } else {
      breakpoint = binding.value;
    }

    if (
      Object.values<MobileDeviceType>(['mobile', 'phone', 'tablet']).includes(
        breakpoint as MobileDeviceType,
      )
    ) {
      condition = binding.value.condition || 'lt';
    }

    const isMobileDevice = (device: MobileDeviceType) => {
      if (device === 'mobile') {
        const isMobileDevice = md.mobile() ? true : false;
        return isMobileDevice
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
      }
      if (device === 'phone') {
        const isPhoneDevice = md.phone() ? true : false;
        return isPhoneDevice
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
      }
      if (device === 'tablet') {
        const isTabletDevice = md.tablet() ? true : false;
        return isTabletDevice
          ? true
          : condition === 'lt'
          ? state.width < breakpoints['bp3']
          : state.width >= breakpoints['bp3'];
      }
    };

    const updateVisibility = () => {
      if (
        Object.values<MobileDeviceType>(['mobile', 'phone', 'tablet']).includes(
          breakpoint as MobileDeviceType,
        )
      ) {
        if (isMobileDevice(breakpoint as MobileDeviceType)) {
          el.style.display = '';
        } else {
          el.style.display = 'none';
        }
      } else if (
        condition === 'lt'
          ? state.width < breakpoints[breakpoint as Breakpoints] + offset
          : state.width >= breakpoints[breakpoint as Breakpoints] + offset
      ) {
        el.style.display = '';
      } else {
        el.style.display = 'none';
      }
    };

    window.addEventListener('resize', updateWidth);
    watch(() => state.width, updateVisibility);
    updateVisibility();

    el._onDestroy = () => {
      window.removeEventListener('resize', updateWidth);
    };
  },
  unmounted(el) {
    el._onDestroy();
  },
};

const Breakpoint = {
  install(app: App) {
    app.config.globalProperties.$screenSize = toRefs(state);
    app.directive('breakpoint', vBreakpoint);
  },
};

export default Breakpoint;
