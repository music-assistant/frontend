import { describe, expect, it } from "vitest";
import { useIcon, type IconProps } from "@/composables/useIcon";

describe("useIcon", () => {
  it("returns default props for default variant", () => {
    const props: IconProps = { variant: "default" };
    const { iconProps, containerClasses, iconClasses } = useIcon(props);

    expect(iconProps.value.size).toBe("24px");
    expect(iconProps.value.class).toContain("icon-default");
    expect(containerClasses.value).toContain("icon-container");
    expect(iconClasses.value).toContain("icon");
    expect(iconClasses.value).toContain("icon--default");
  });

  it("returns button styling for button variant", () => {
    const props: IconProps = { variant: "button" };
    const { iconProps, containerClasses } = useIcon(props);

    expect(iconProps.value.class).toContain("icon-button");
    expect(containerClasses.value).toContain("icon-container--button");
  });

  it("returns responsive styling for responsive variant", () => {
    const props: IconProps = { variant: "responsive" };
    const { iconProps, containerClasses } = useIcon(props);

    expect(iconProps.value.class).toContain("icon-responsive");
    expect(containerClasses.value).toContain("icon-container--responsive");
  });

  it("prioritizes static dimensions", () => {
    const props: IconProps = {
      staticWidth: "32px",
      staticHeight: "32px",
      width: "16px",
      height: "16px",
    };
    const { containerStyle } = useIcon(props);

    expect(containerStyle.value.width).toBe("32px");
    expect(containerStyle.value.height).toBe("32px");
  });

  it("falls back to regular dimensions when static not provided", () => {
    const props: IconProps = {
      width: "16px",
      height: "16px",
    };
    const { containerStyle } = useIcon(props);

    expect(containerStyle.value.width).toBe("16px");
    expect(containerStyle.value.height).toBe("16px");
  });

  it("handles min/max dimensions", () => {
    const props: IconProps = {
      minWidth: "12px",
      minHeight: "12px",
      maxWidth: "48px",
      maxHeight: "48px",
    };
    const { containerStyle } = useIcon(props);

    expect(containerStyle.value.minWidth).toBe("12px");
    expect(containerStyle.value.minHeight).toBe("12px");
    expect(containerStyle.value.maxWidth).toBe("48px");
    expect(containerStyle.value.maxHeight).toBe("48px");
  });

  it("uses provided size when explicitly set", () => {
    const props: IconProps = {
      staticWidth: "32px",
      size: "16px",
    };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("16px");
  });

  it("uses provided size even when staticHeight provided", () => {
    const props: IconProps = {
      staticHeight: "32px",
      size: "16px",
    };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("16px");
  });

  it("uses provided size when no static dimensions", () => {
    const props: IconProps = { size: "16px" };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("16px");
  });

  it("falls back to staticWidth when no size provided", () => {
    const props: IconProps = { staticWidth: "32px" };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("32px");
  });

  it("falls back to staticHeight when no size or staticWidth provided", () => {
    const props: IconProps = { staticHeight: "32px" };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("32px");
  });

  it("defaults to 24px when no size specified", () => {
    const props: IconProps = {};
    const { iconProps } = useIcon(props);

    expect(iconProps.value.size).toBe("24px");
  });

  it("merges custom classes correctly", () => {
    const props: IconProps = {
      variant: "button",
      class: "custom-class",
    };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.class).toBe("icon-button custom-class");
  });

  it("handles object style correctly", () => {
    const props: IconProps = {
      style: { color: "red", opacity: "0.5" },
    };
    const { containerStyle } = useIcon(props);

    expect(containerStyle.value.color).toBe("red");
    expect(containerStyle.value.opacity).toBe("0.5");
  });

  it("parses string style correctly", () => {
    const props: IconProps = {
      style: "color: blue; opacity: 0.8",
    };
    const { containerStyle } = useIcon(props);

    expect(containerStyle.value.color).toBe("blue");
    expect(containerStyle.value.opacity).toBe("0.8");
  });

  it("handles disabled state in classes", () => {
    const props: IconProps = { disabled: true };
    const { containerClasses } = useIcon(props);

    expect(containerClasses.value).toContain("icon-container--disabled");
  });

  it("preserves vuetify props", () => {
    const props: IconProps = {
      icon: "mdi-home",
      color: "primary",
      disabled: true,
    };
    const { iconProps } = useIcon(props);

    expect(iconProps.value.icon).toBe("mdi-home");
    expect(iconProps.value.color).toBe("primary");
    expect(iconProps.value.disabled).toBe(true);
  });
});
