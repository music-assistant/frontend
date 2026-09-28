import FormTextField from "@/components/forms/FormTextField.vue";
import type { AnyFieldApi } from "@tanstack/form-core";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

/** A minimal stand-in for a TanStack field api, with the bits the component reads. */
function fakeField(
  overrides: {
    name?: string;
    value?: string;
    errors?: string[];
  } = {},
): AnyFieldApi {
  return {
    name: overrides.name ?? "username",
    state: {
      value: overrides.value ?? "",
      meta: { errors: overrides.errors ?? [] },
    },
    handleBlur: vi.fn(),
    handleChange: vi.fn(),
  } as unknown as AnyFieldApi;
}

describe("FormTextField", () => {
  it("binds the field name to the input id, name and label", () => {
    const wrapper = mount(FormTextField, {
      props: { field: fakeField({ name: "password" }), label: "Password" },
    });

    const input = wrapper.get("input");
    expect(input.attributes("id")).toBe("password");
    expect(input.attributes("name")).toBe("password");
    expect(wrapper.get('[data-slot="field-label"]').text()).toBe("Password");
  });

  it("forwards type and autocomplete to the input", () => {
    const wrapper = mount(FormTextField, {
      props: {
        field: fakeField(),
        label: "Password",
        type: "password",
        autocomplete: "new-password",
      },
    });

    const input = wrapper.get("input");
    expect(input.attributes("type")).toBe("password");
    expect(input.attributes("autocomplete")).toBe("new-password");
  });

  it("updates the field and emits the value on input", async () => {
    const field = fakeField();
    const wrapper = mount(FormTextField, {
      props: { field, label: "Username" },
    });

    await wrapper.get("input").setValue("marcel");

    expect(field.handleChange).toHaveBeenCalledWith("marcel");
    expect(wrapper.emitted("change")?.at(-1)).toEqual(["marcel"]);
  });

  it("marks the field invalid and shows its errors", () => {
    const wrapper = mount(FormTextField, {
      props: {
        field: fakeField({ errors: ["Too short"] }),
        label: "Username",
      },
    });

    expect(wrapper.get("input").attributes("aria-invalid")).toBe("true");
    expect(wrapper.get('[data-slot="field-error"]').text()).toContain(
      "Too short",
    );
  });

  it("skips validation state when showValidation is false", () => {
    const wrapper = mount(FormTextField, {
      props: {
        field: fakeField({ errors: ["Too short"] }),
        label: "Display name",
        showValidation: false,
      },
    });

    expect(wrapper.get("input").attributes("aria-invalid")).toBeUndefined();
    expect(wrapper.find('[data-slot="field-error"]').exists()).toBe(false);
  });

  it("hides the description while invalid when asked to", () => {
    const wrapper = mount(FormTextField, {
      props: {
        field: fakeField({ errors: ["Too long"] }),
        label: "Display name",
        description: "Optional",
        descriptionMode: "hideWhenInvalid",
      },
    });

    expect(wrapper.find('[data-slot="field-description"]').exists()).toBe(
      false,
    );
  });
});
