import { describe, expect, it } from "vitest";
import { useButton, type ButtonProps } from "@/composables/useButton";

describe("useButton", () => {
  it("returns default props for default variant", () => {
    const props: ButtonProps = { variant: "default" };
    const { buttonProps, buttonClasses } = useButton(props);

    expect(buttonProps.value.variant).toBe("text");
    expect(buttonProps.value.ripple).toBe(true);
    expect(buttonClasses.value).toContain("button");
    expect(buttonClasses.value).toContain("button--default");
  });

  it("returns responsive styling for responsive variant", () => {
    const props: ButtonProps = { variant: "responsive" };
    const { buttonProps, buttonClasses } = useButton(props);

    expect(buttonProps.value.icon).toBe(true);
    expect(buttonProps.value.variant).toBe("text");
    expect(buttonProps.value.class).toContain("btn-responsive");
    expect(typeof buttonProps.value.style).toBe("object");
    expect(
      (buttonProps.value.style as Record<string, string | number>).height,
    ).toBeDefined();
    expect(
      (buttonProps.value.style as Record<string, string | number>).width,
    ).toBeDefined();
  });

  it("returns icon styling for icon variant", () => {
    const props: ButtonProps = { variant: "icon" };
    const { buttonProps, buttonClasses } = useButton(props);

    expect(buttonProps.value.icon).toBe(true);
    expect(buttonProps.value.variant).toBe("plain");
    expect(buttonProps.value.class).toContain("btn-icon");
  });

  it("returns list styling for list variant", () => {
    const props: ButtonProps = { variant: "list" };
    const { buttonProps, buttonClasses } = useButton(props);

    expect(buttonProps.value.variant).toBe("plain");
    expect(buttonProps.value.density).toBe("comfortable");
    expect(buttonProps.value.class).toContain("btn-list");
  });

  it("handles nav modifier in classes", () => {
    const props: ButtonProps = { variant: "default", nav: true };
    const { buttonClasses } = useButton(props);

    expect(buttonClasses.value).toContain("button--nav");
  });

  it("merges custom classes correctly", () => {
    const props: ButtonProps = {
      variant: "icon",
      class: "custom-class",
    };
    const { buttonProps } = useButton(props);

    expect(buttonProps.value.class).toBe("btn-icon custom-class");
  });

  it("handles aria-label correctly when no title", () => {
    const props: ButtonProps = {
      "aria-label": "Custom Aria Label",
    };
    const { buttonProps } = useButton(props);

    expect(buttonProps.value["aria-label"]).toBe("Custom Aria Label");
  });

  it("prioritizes title over aria-label", () => {
    const props: ButtonProps = {
      title: "Button Title",
      "aria-label": "Custom Aria Label",
    };
    const { buttonProps } = useButton(props);

    expect(buttonProps.value["aria-label"]).toBe("Button Title");
  });

  it("falls back to title for aria-label", () => {
    const props: ButtonProps = {
      title: "Button Title",
    };
    const { buttonProps } = useButton(props);

    expect(buttonProps.value["aria-label"]).toBe("Button Title");
  });

  it("preserves other vuetify props", () => {
    const props: ButtonProps = {
      variant: "default",
      disabled: true,
      color: "primary",
      size: "large",
    };
    const { buttonProps } = useButton(props);

    expect(buttonProps.value.disabled).toBe(true);
    expect(buttonProps.value.color).toBe("primary");
    expect(buttonProps.value.size).toBe("large");
  });
});
