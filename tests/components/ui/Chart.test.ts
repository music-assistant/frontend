import { ChartTooltipContent, componentToString } from "@/components/ui/chart";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, ref, type Ref } from "vue";

const config = { plays: { label: "Plays", color: "var(--primary)" } };

type Template = (data: Record<string, unknown>, x: number) => string;

/** A tooltip template made the way a chart makes it, in a component setup. */
function makeTemplate(locale: Ref<string>): Template {
  let template: Template | undefined;
  mount(
    defineComponent({
      setup() {
        template = componentToString(config, ChartTooltipContent, () => ({
          labelKey: "label",
          locale: locale.value,
        }));
        return () => null;
      },
    }),
  );
  return template!;
}

describe("componentToString with ChartTooltipContent", () => {
  it("shows a value of zero", () => {
    const template = makeTemplate(ref("en-GB"));

    const html = template({ label: "Monday", plays: 0 }, 0);

    expect(html).toContain("Monday");
    expect(html).toMatch(/>\s*0\s*</);
  });

  it("formats numbers in the current locale, also after it changes", () => {
    const locale = ref("de-DE");
    const template = makeTemplate(locale);
    const data = { label: "Monday", plays: 1234 };

    expect(template(data, 0)).toContain("1.234");

    locale.value = "en-GB";
    expect(template(data, 0)).toContain("1,234");
  });
});
