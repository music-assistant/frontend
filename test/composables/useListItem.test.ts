import { describe, expect, it } from "vitest";
import { useListItem, type ListItemProps } from "@/composables/useListItem";

describe("useListItem", () => {
  it("returns default props for default variant", () => {
    const props: ListItemProps = { variant: "default" };
    const { listItemProps, listItemClasses } = useListItem(props);

    expect(listItemProps.value.class).toContain("list-item-default");
    expect(listItemClasses.value).toContain("list-item-main");
    expect(listItemClasses.value).toContain("list-item--default");
  });

  it("returns compact styling for compact variant", () => {
    const props: ListItemProps = { variant: "compact" };
    const { listItemProps, listItemClasses } = useListItem(props);

    expect(listItemProps.value.density).toBe("compact");
    expect(listItemProps.value.class).toContain("list-item-compact");
    expect(listItemClasses.value).toContain("list-item--compact");
  });

  it("returns comfortable styling for comfortable variant", () => {
    const props: ListItemProps = { variant: "comfortable" };
    const { listItemProps, listItemClasses } = useListItem(props);

    expect(listItemProps.value.density).toBe("comfortable");
    expect(listItemProps.value.class).toContain("list-item-comfortable");
    expect(listItemClasses.value).toContain("list-item--comfortable");
  });

  it("preserves custom density when provided", () => {
    const props: ListItemProps = {
      variant: "compact",
      density: "default",
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value.density).toBe("default");
  });

  it("merges custom classes correctly", () => {
    const props: ListItemProps = {
      variant: "compact",
      class: "custom-class",
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value.class).toBe("list-item-compact custom-class");
  });

  it("handles aria-label correctly", () => {
    const props: ListItemProps = {
      "aria-label": "Custom Label",
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value["aria-label"]).toBe("Custom Label");
  });

  it("preserves vuetify props", () => {
    const props: ListItemProps = {
      variant: "default",
      active: true,
      disabled: false,
      title: "Test Title",
      subtitle: "Test Subtitle",
      value: "test-value",
      color: "primary",
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value.active).toBe(true);
    expect(listItemProps.value.disabled).toBe(false);
    expect(listItemProps.value.title).toBe("Test Title");
    expect(listItemProps.value.subtitle).toBe("Test Subtitle");
    expect(listItemProps.value.value).toBe("test-value");
    expect(listItemProps.value.color).toBe("primary");
  });

  it("handles navigation props", () => {
    const props: ListItemProps = {
      to: "/test-route",
      href: "https://example.com",
      replace: true,
      exact: true,
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value.to).toBe("/test-route");
    expect(listItemProps.value.href).toBe("https://example.com");
    expect(listItemProps.value.replace).toBe(true);
    expect(listItemProps.value.exact).toBe(true);
  });

  it("handles styling props", () => {
    const props: ListItemProps = {
      height: "48px",
      lines: "two",
      rounded: true,
      tag: "li",
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value.height).toBe("48px");
    expect(listItemProps.value.lines).toBe("two");
    expect(listItemProps.value.rounded).toBe(true);
    expect(listItemProps.value.tag).toBe("li");
  });

  it("filters out non-vuetify props", () => {
    const props: ListItemProps = {
      variant: "compact",
      showMenuBtn: true,
    };
    const { listItemProps } = useListItem(props);

    expect(listItemProps.value).not.toHaveProperty("variant");
    expect(listItemProps.value).not.toHaveProperty("showMenuBtn");
  });

  it("handles object class correctly", () => {
    const props: ListItemProps = {
      variant: "default",
      class: { active: true, disabled: false },
    };
    const { listItemProps } = useListItem(props);

    // Should still add the variant class
    expect(listItemProps.value.class).toContain("list-item-default");
  });
});
