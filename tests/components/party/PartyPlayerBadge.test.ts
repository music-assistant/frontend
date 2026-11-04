import PartyPlayerBadge from "@/components/party/PartyPlayerBadge.vue";
import { Rocket, UserRound } from "@lucide/vue";
import { mount } from "@vue/test-utils";
import { describe, expect, it, vi } from "vitest";

vi.mock("@/plugins/i18n", () => ({ $t: (key: string) => key }));

describe("PartyPlayerBadge", () => {
  it.each([
    { type: "boost" as const, icon: Rocket },
    { type: "request" as const, icon: UserRound },
  ])("shows the $type label and lucide icon", ({ type, icon }) => {
    const wrapper = mount(PartyPlayerBadge, {
      props: { type, badgeColor: "#123456" },
    });

    expect(wrapper.findComponent(icon).exists()).toBe(true);
    expect(wrapper.text()).toBe(`providers.party.${type}`);
    expect(wrapper.attributes("style")).toContain("background: #123456");
    expect(wrapper.find("svg").attributes("aria-hidden")).toBe("true");
    wrapper.unmount();
  });
});
