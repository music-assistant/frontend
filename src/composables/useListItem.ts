import { match } from "ts-pattern";
import { computed } from "vue";
import { mergeClasses } from "./utils";

export interface ListItemProps {
  /**
   * Whether to show the context menu button
   */
  showMenuBtn?: boolean;

  /**
   * Variant for different list item styles
   * - `default`: Standard list item
   * - `compact`: More compact spacing
   * - `comfortable`: More spacious layout
   */
  variant?: "default" | "compact" | "comfortable";

  // Pass through all Vuetify v-list-item props
  active?: boolean;
  disabled?: boolean;
  link?: boolean;
  nav?: boolean;
  density?: "default" | "comfortable" | "compact";
  height?: string | number;
  lines?: "one" | "two" | "three" | false;
  subtitle?: string;
  title?: string;
  value?: any;
  color?: string;
  rounded?: boolean | string | number;
  tag?: string;
  to?: string | object;
  href?: string;
  replace?: boolean;
  exact?: boolean;

  // CSS and styling
  class?: string | string[] | Record<string, boolean>;
  style?: string | Record<string, string | number>;

  // Accessibility
  "aria-label"?: string;
  role?: string;
}

export interface ListItemEmits {
  (e: "click", event: Event): void;
  (e: "menu", event: Event): void;
  (e: "input", value: any): void;
}

export const useListItem = (props: ListItemProps) => {
  const listItemProps = computed(() => {
    const { variant, showMenuBtn, ...vuetifyProps } = props;

    const baseProps = {
      ...vuetifyProps,
      "aria-label": props["aria-label"],
    };

    return match(variant)
      .with("compact", () => ({
        ...baseProps,
        density: props.density || "compact",
        class: props.class
          ? `list-item-compact ${props.class}`
          : "list-item-compact",
      }))
      .with("comfortable", () => ({
        ...baseProps,
        density: props.density || "comfortable",
        class: props.class
          ? `list-item-comfortable ${props.class}`
          : "list-item-comfortable",
      }))
      .with("default", () => ({
        ...baseProps,
        class: props.class
          ? `list-item-default ${props.class}`
          : "list-item-default",
      }))
      .otherwise(() => ({
        ...baseProps,
        class: props.class
          ? `list-item-default ${props.class}`
          : "list-item-default",
      }));
  });

  const listItemClasses = computed(() => {
    return mergeClasses(
      "list-item-main",
      props.variant && `list-item--${props.variant}`,
    );
  });

  return {
    listItemProps,
    listItemClasses,
  };
};

export const defaultListItemProps = {
  variant: "default" as const,
  showMenuBtn: false,
  link: false,
};
