import { match } from "ts-pattern";
import { computed } from "vue";
import type { RouteLocationRaw } from "vue-router";

const mergeClasses = (...classes: (string | false | undefined | null)[]) =>
  classes.filter(Boolean).join(" ");

export interface ButtonProps {
  /**
   * Button variant that determines styling and behavior
   * - `default`: Standard text button
   * - `plain`: Minimal styling
   * - `responsive`: Large responsive button for touch interfaces
   * - `icon`: Icon-only button with reduced padding
   * - `list`: Button optimized for use in lists
   */
  variant?: "default" | "plain" | "responsive" | "icon" | "list";

  /**
   * Whether this button is used in navigation (affects styling)
   */
  nav?: boolean;

  // Vuetify button props
  icon?: string | boolean;
  ripple?: boolean;
  height?: string | number;
  width?: string | number;
  size?: string | number;
  title?: string;
  disabled?: boolean;
  color?: string;
  to?: RouteLocationRaw;
  block?: boolean;
  density?: "default" | "comfortable" | "compact";
  flat?: boolean;
  loading?: boolean;
  outlined?: boolean;
  rounded?: boolean | string | number;
  tag?: string;
  text?: boolean;
  type?: "button" | "submit" | "reset";
  value?: unknown;
  active?: boolean;
  append?: boolean;
  exact?: boolean;
  replace?: boolean;
  slim?: boolean;
  stacked?: boolean;
  class?: string | string[] | Record<string, boolean>;
  style?: string | Record<string, string | number>;
  "aria-label"?: string;
}

export interface ButtonEmits {
  (e: "click", event: MouseEvent): void;
}

export const useButton = (props: ButtonProps) => {
  const buttonProps = computed(() => {
    const { variant, nav, ...vuetifyProps } = props;

    const baseProps = {
      ...vuetifyProps,
      "aria-label": props.title || props["aria-label"],
    };

    return match(variant)
      .with("responsive", () => ({
        ...baseProps,
        icon: true,
        variant: "text" as const,
        ripple: props.ripple !== false,
        class: props.class ? `btn-responsive ${props.class}` : "btn-responsive",
        style: {
          height:
            "var(--responsive-button-size, min(calc(100vw - 40px), calc(100vh - 340px)))",
          width:
            "var(--responsive-button-size, min(calc(100vw - 40px), calc(100vh - 340px)))",
          ...(typeof props.style === "object" ? props.style : {}),
        },
      }))
      .with("icon", () => ({
        ...baseProps,
        icon: true,
        variant: "text" as const,
        ripple: props.ripple !== false,
        class: props.class ? `btn-icon ${props.class}` : "btn-icon",
      }))
      .with("list", () => ({
        ...baseProps,
        variant: "text" as const,
        density: "comfortable" as const,
        ripple: props.ripple !== false,
        class: props.class ? `btn-list ${props.class}` : "btn-list",
      }))
      .with("plain", () => ({
        ...baseProps,
        variant: "plain" as const,
        ripple: props.ripple !== false,
      }))
      .with("default", () => ({
        ...baseProps,
        variant: "text" as const,
        ripple: props.ripple !== false,
      }))
      .otherwise(() => ({
        ...baseProps,
        variant: "text" as const,
        ripple: props.ripple !== false,
      }));
  });

  const buttonClasses = computed(() => {
    return mergeClasses(
      "button",
      props.variant && `button--${props.variant}`,
      props.nav && "button--nav",
    );
  });

  return {
    buttonProps,
    buttonClasses,
  };
};

export const defaultButtonProps = {
  variant: "default" as const,
  ripple: true,
};
