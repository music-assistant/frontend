import { describe, expect, it } from "vitest";
import { useContainer, type ContainerProps } from "@/composables/useContainer";

describe("useContainer", () => {
  it("returns default props for default variant", () => {
    const props: ContainerProps = { variant: "default" };
    const { containerProps, containerClasses } = useContainer(props, false);

    expect(containerProps.value.fluid).toBe(true);
    expect(containerClasses.value).toContain("container-main");
    expect(containerClasses.value).toContain("container-default");
  });

  it("returns panel styling for panel variant in light mode", () => {
    const props: ContainerProps = { variant: "panel" };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("container-main");
    expect(containerClasses.value).toContain("container-panel");
    expect(containerClasses.value).toContain("container-panel--light");
  });

  it("returns panel styling for panel variant in dark mode", () => {
    const props: ContainerProps = { variant: "panel" };
    const { containerClasses } = useContainer(props, true);

    expect(containerClasses.value).toContain("container-main");
    expect(containerClasses.value).toContain("container-panel");
    expect(containerClasses.value).toContain("container-panel--dark");
  });

  it("returns compact styling for compact variant", () => {
    const props: ContainerProps = { variant: "compact" };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("container-main");
    expect(containerClasses.value).toContain("container-compact");
  });

  it("returns comfortable styling for comfortable variant", () => {
    const props: ContainerProps = { variant: "comfortable" };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("container-main");
    expect(containerClasses.value).toContain("container-comfortable");
  });

  it("handles custom string class correctly", () => {
    const props: ContainerProps = {
      variant: "default",
      class: "custom-class",
    };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("custom-class");
  });

  it("handles custom array class correctly", () => {
    const props: ContainerProps = {
      variant: "default",
      class: ["class1", "class2"],
    };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("class1");
    expect(containerClasses.value).toContain("class2");
  });

  it("handles custom object class correctly", () => {
    const props: ContainerProps = {
      variant: "default",
      class: { active: true, disabled: false },
    };
    const { containerClasses } = useContainer(props, false);

    expect(containerClasses.value).toContain("active");
    expect(containerClasses.value).not.toContain("disabled");
  });

  it("preserves vuetify props", () => {
    const props: ContainerProps = {
      variant: "default",
      fluid: false,
      tag: "section",
    };
    const { containerProps } = useContainer(props, false);

    expect(containerProps.value.fluid).toBe(false);
    expect(containerProps.value.tag).toBe("section");
  });

  it("defaults fluid to true when not specified", () => {
    const props: ContainerProps = { variant: "default" };
    const { containerProps } = useContainer(props, false);

    expect(containerProps.value.fluid).toBe(true);
  });
});
