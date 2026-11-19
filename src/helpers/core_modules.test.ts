import { describe, expect, it } from "vitest";
import { coreModuleName } from "./core_modules";

// the texts the app has, giving the key itself for any other
const translate = (key: string) =>
  ({ "settings.core_module.streams.name": "Streams" })[key] ?? key;

describe("coreModuleName", () => {
  it("takes the translated name of the module", () => {
    expect(coreModuleName("streams", translate, "Streamserver")).toBe(
      "Streams",
    );
  });

  it("takes the name in the manifest without a translation", () => {
    expect(coreModuleName("radio_tuner", translate, "Radio tuner")).toBe(
      "Radio tuner",
    );
  });

  it("takes the domain without either", () => {
    expect(coreModuleName("radio_tuner", translate)).toBe("radio_tuner");
  });
});
