import ListeningHeatmapCard from "@/components/statistics/ListeningHeatmapCard.vue";
import { i18n } from "@/plugins/i18n";
import { enableAutoUnmount, mount } from "@vue/test-utils";
import { afterEach, describe, expect, it } from "vitest";
import { nextTick } from "vue";

enableAutoUnmount(afterEach);

const originalLocale = i18n.global.locale.value;
const props = {
  title: "Listening activity",
  data: [{ weekday: 0, hour: 12, value: 1 }],
};

afterEach(() => {
  i18n.global.locale.value = originalLocale;
});

const expectedWeekdays = (locale: string): string[] => {
  const formatter = new Intl.DateTimeFormat(locale, {
    weekday: "short",
    timeZone: "UTC",
  });
  return Array.from({ length: 7 }, (_, weekday) =>
    formatter.format(new Date(Date.UTC(2024, 0, weekday + 1))),
  );
};

describe("ListeningHeatmapCard locales", () => {
  it.each([
    ["en_GB", "en-GB"],
    ["bg_BG", "bg-BG"],
    ["pt_BR", "pt-BR"],
    ["en", "en"],
  ])("renders localized weekdays for %s", (locale, canonicalLocale) => {
    i18n.global.locale.value = locale;

    const wrapper = mount(ListeningHeatmapCard, { props });

    expect(
      wrapper.findAll('tbody th[scope="row"]').map((cell) => cell.text()),
    ).toEqual(expectedWeekdays(canonicalLocale));
  });

  it("updates weekday labels when the locale changes", async () => {
    i18n.global.locale.value = "en_GB";
    const wrapper = mount(ListeningHeatmapCard, { props });

    i18n.global.locale.value = "pt_BR";
    await nextTick();

    expect(
      wrapper.findAll('tbody th[scope="row"]').map((cell) => cell.text()),
    ).toEqual(expectedWeekdays("pt-BR"));
  });
});
