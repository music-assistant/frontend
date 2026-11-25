import { h, type Component } from "vue";
import { VIcon } from "vuetify/components";

export const ContextMenuItemIcon = (props: {
  icon?: string | Component;
  size?: number;
}) => {
  if (!props.icon) return null;
  return typeof props.icon === "string"
    ? h(VIcon, {
        icon: props.icon,
        size: props.size ?? 20,
        class: "shrink-0",
      })
    : h(props.icon, { class: "size-5 shrink-0 scale-90" });
};
