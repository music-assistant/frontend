import {
  ChartTooltipContent,
  componentToString,
  type ChartConfig,
} from "@/components/ui/chart";
import { mount } from "@vue/test-utils";
import { describe, expect, it } from "vitest";
import { defineComponent, ref } from "vue";

type Template = (data: Record<string, unknown>, x: number) => string;

/** A tooltip template made the way a chart makes it, in a component setup. */
function makeTemplate(
  config: () => ChartConfig,
  locale: () => string = () => "en-GB",
): Template {
  let template: Template | undefined;
  mount(
    defineComponent({
      setup() {
        template = componentToString(config, ChartTooltipContent, () => ({
          labelKey: "label",
          locale: locale(),
        }));
        return () => null;
      },
    }),
  );
  return template!;
}

const playsConfig = () => ({
  plays: { label: "Plays", color: "var(--primary)" },
});

describe("componentToString with ChartTooltipContent", () => {
  it("shows a value of zero", () => {
    const template = makeTemplate(playsConfig);

    const html = template({ label: "Monday", plays: 0 }, 0);

    expect(html).toContain("Monday");
    expect(html).toMatch(/>\s*0\s*</);
  });

  it("formats numbers in the current locale, also after it changes", () => {
    const locale = ref("de-DE");
    const template = makeTemplate(playsConfig, () => locale.value);
    const data = { label: "Monday", plays: 1234 };

    expect(template(data, 0)).toContain("1.234");

    locale.value = "en-GB";
    expect(template(data, 0)).toContain("1,234");
  });

  it("follows a label that changes after mount", () => {
    const label = ref("Plays");
    const template = makeTemplate(() => ({ plays: { label: label.value } }));
    const data = { label: "Monday", plays: 3 };

    expect(template(data, 0)).toContain("Plays");

    label.value = "Wiedergaben";
    expect(template(data, 0)).toContain("Wiedergaben");
  });
});
