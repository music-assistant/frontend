import ChoiceCards from "@/components/onboarding/ChoiceCards.vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { h, markRaw } from "vue";

// the cards render whatever icon they are handed; what it draws is its own
const icon = markRaw({ render: () => h("i") });

const OPTIONS = [
  {
    value: "first",
    icon,
    labelKey: "first.label",
    descriptionKey: "first.description",
  },
  {
    value: "second",
    icon,
    labelKey: "second.label",
    descriptionKey: "second.description",
  },
];

function mountCards(props: Record<string, unknown> = {}) {
  return mount(ChoiceCards, {
    props: {
      options: OPTIONS,
      labelledBy: "the-question",
      testIdPrefix: "choice",
      ...props,
    },
    global: { mocks: { $t: (key: string) => key } },
  });
}

function card(wrapper: ReturnType<typeof mountCards>, value: string) {
  return wrapper.find(`[data-testid=choice-${value}]`);
}

describe("ChoiceCards", () => {
  it("puts the cards under the question they answer", () => {
    const wrapper = mountCards();

    // one question, several answers: a screen reader reads it before them
    const group = wrapper.find("[role=group]");
    expect(group.exists()).toBe(true);
    expect(group.attributes("aria-labelledby")).toBe("the-question");
    expect(wrapper.findAll("button")).toHaveLength(2);
    expect(card(wrapper, "first").text()).toContain("first.label");
    expect(card(wrapper, "first").text()).toContain("first.description");

    wrapper.unmount();
  });

  it("shows which answer is the one on the account", () => {
    const wrapper = mountCards({ selected: "second" });

    expect(card(wrapper, "second").attributes("aria-pressed")).toBe("true");
    expect(card(wrapper, "first").attributes("aria-pressed")).toBe("false");

    wrapper.unmount();
  });

  it("hands the answer that was picked to the step", async () => {
    const wrapper = mountCards();

    await card(wrapper, "first").trigger("click");

    expect(wrapper.emitted("select")).toEqual([["first"]]);

    wrapper.unmount();
  });

  it("stays inert while an answer is on its way to the server", async () => {
    const wrapper = mountCards({ busy: true });

    expect(card(wrapper, "first").attributes("disabled")).toBeDefined();
    await card(wrapper, "first").trigger("click");

    expect(wrapper.emitted("select")).toBeUndefined();

    wrapper.unmount();
  });
});
