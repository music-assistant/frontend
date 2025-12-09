import { match } from "ts-pattern";
import { computed } from "vue";

export interface ContainerProps {
  /**
   * Container variant that determines styling
   * - `default`: Standard container with basic padding
   * - `panel`: Container with panel-style background based on theme
   * - `compact`: Container with reduced padding
   * - `comfortable`: Container with increased padding
   */
  variant?: "default" | "panel" | "compact" | "comfortable";

  // Pass through all Vuetify v-container props
  fluid?: boolean;
  tag?: string;

  // CSS and styling
  class?: string | string[] | Record<string, boolean>;
  style?: string | Record<string, string | number>;
}

export interface ContainerEmits {}

export const useContainer = (props: ContainerProps, isDark: boolean) => {
  const containerProps = computed(() => {
    const { variant, ...vuetifyProps } = props;

    const baseProps = {
      ...vuetifyProps,
      fluid: props.fluid !== false,
    };

    return baseProps;
  });

  const containerClasses = computed(() => {
    const variantClasses = match(props.variant)
      .with("panel", () => [
        "container-main",
        "container-panel",
        isDark ? "container-panel--dark" : "container-panel--light",
      ])
      .with("compact", () => ["container-main", "container-compact"])
      .with("comfortable", () => ["container-main", "container-comfortable"])
      .with("default", () => ["container-main", "container-default"])
      .otherwise(() => ["container-main", "container-default"]);

    const userClasses: string[] = [];
    if (props.class) {
      if (typeof props.class === "string") {
        userClasses.push(props.class);
      } else if (Array.isArray(props.class)) {
        userClasses.push(...props.class);
      } else {
        Object.entries(props.class).forEach(([className, shouldInclude]) => {
          if (shouldInclude) userClasses.push(className);
        });
      }
    }

    return [...variantClasses, ...userClasses].join(" ");
  });

  return {
    containerProps,
    containerClasses,
  };
};

export const defaultContainerProps = {
  variant: "default" as const,
  fluid: true,
};
