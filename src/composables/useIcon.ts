import { match } from "ts-pattern";
import { computed } from "vue";
import { mergeClasses } from "./utils";

export interface IconProps {
  /**
   * Icon variant that determines styling and behavior
   * - `default`: Standard icon
   * - `button`: Icon with button-like behavior and hover effects
   * - `responsive`: Icon that resizes based on container
   */
  variant?: "default" | "button" | "responsive";

  // Icon sizing props
  width?: string;
  height?: string;
  staticWidth?: string;
  staticHeight?: string;
  maxWidth?: string;
  maxHeight?: string;
  minWidth?: string;
  minHeight?: string;

  // Vuetify icon props
  icon?: string;
  color?: string;
  disabled?: boolean;
  size?: string | number;

  // Badge support
  badge?: boolean;

  // CSS and styling
  class?: string | string[] | Record<string, boolean>;
  style?: string | Record<string, string | number>;
}

export interface IconEmits {
  (e: "click", event: MouseEvent): void;
}

export const useIcon = (props: IconProps) => {
  const iconProps = computed(() => {
    const {
      variant,
      width,
      height,
      staticWidth,
      staticHeight,
      maxWidth,
      maxHeight,
      minWidth,
      minHeight,
      badge,
      ...vuetifyProps
    } = props;

    const baseProps = {
      ...vuetifyProps,
      size: props.size || (staticWidth || staticHeight ? undefined : "24px"),
    };

    return match(variant)
      .with("button", () => ({
        ...baseProps,
        class: props.class ? `icon-button ${props.class}` : "icon-button",
      }))
      .with("responsive", () => ({
        ...baseProps,
        class: props.class
          ? `icon-responsive ${props.class}`
          : "icon-responsive",
      }))
      .with("default", () => ({
        ...baseProps,
        class: props.class ? `icon-default ${props.class}` : "icon-default",
      }))
      .otherwise(() => ({
        ...baseProps,
        class: props.class ? `icon-default ${props.class}` : "icon-default",
      }));
  });

  const containerStyle = computed(() => {
    const styles: Record<string, string> = {};

    if (props.width) styles.width = props.staticWidth || props.width;
    if (props.height) styles.height = props.staticHeight || props.height;
    if (props.maxWidth) styles.maxWidth = props.maxWidth;
    if (props.maxHeight) styles.maxHeight = props.maxHeight;
    if (props.minWidth) styles.minWidth = props.minWidth;
    if (props.minHeight) styles.minHeight = props.minHeight;

    if (typeof props.style === "object") {
      Object.assign(styles, props.style);
    } else if (typeof props.style === "string") {
      const parsed = props.style.split(";").reduce(
        (acc, rule) => {
          const [prop, value] = rule.split(":").map((s) => s.trim());
          if (prop && value) acc[prop] = value;
          return acc;
        },
        {} as Record<string, string>,
      );
      Object.assign(styles, parsed);
    }

    return styles;
  });

  const containerClasses = computed(() => {
    return mergeClasses(
      "icon-container",
      props.variant && `icon-container--${props.variant}`,
      props.disabled && "icon-container--disabled",
    );
  });

  const iconClasses = computed(() => {
    return mergeClasses("icon", props.variant && `icon--${props.variant}`);
  });

  return {
    iconProps,
    containerStyle,
    containerClasses,
    iconClasses,
  };
};

export const defaultIconProps = {
  variant: "default" as const,
  minWidth: "24px",
  minHeight: "24px",
  badge: false,
  disabled: false,
};
