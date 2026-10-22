import { Button } from "@/components/ui/button";
import ProviderLinkButton from "@/components/ProviderLinkButton.vue";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { providerMapping } from "../fixtures/providerMapping";

const { shareProviderLink, copyProviderLink, device } = vi.hoisted(() => ({
  shareProviderLink: vi.fn(),
  copyProviderLink: vi.fn(),
  device: { mobile: false },
}));
vi.mock("@/composables/useProviderLinkSharing", () => ({
  shareProviderLink,
  copyProviderLink,
}));
vi.mock("@/helpers/device", () => ({
  get IS_MOBILE_UA() {
    return device.mobile;
  },
}));
vi.mock("@/plugins/api", () => ({
  api: {
    getProviderManifest: (domain: string) => ({
      name: domain === "ytmusic" ? "YouTube Music" : "Spotify",
    }),
  },
}));

const url = "https://music.youtube.com/watch?v=meuR1l4j-xs";
const wrappers: VueWrapper[] = [];

function mountButton(
  mappings = [providerMapping({ provider_domain: "ytmusic", url })],
  realDropdown = false,
) {
  const wrapper = mount(ProviderLinkButton, {
    attachTo: document.body,
    props: { mappings, title: "Attention" },
    global: {
      mocks: {
        $t: (key: string, args?: { provider: string }) =>
          args ? `${key}: ${args.provider}` : key,
      },
      stubs: realDropdown
        ? {}
        : {
            DropdownMenu: { template: "<div><slot /></div>" },
            DropdownMenuTrigger: { template: "<div><slot /></div>" },
            DropdownMenuContent: { template: "<div><slot /></div>" },
            DropdownMenuItem: {
              emits: ["select"],
              template: "<button @click=\"$emit('select')\"><slot /></button>",
            },
          },
    },
  });
  wrappers.push(wrapper);
  return wrapper;
}

describe("ProviderLinkButton", () => {
  afterEach(() => {
    wrappers.splice(0).forEach((wrapper) => wrapper.unmount());
    document.body.innerHTML = "";
    vi.unstubAllGlobals();
  });
  beforeEach(() => {
    vi.clearAllMocks();
    device.mobile = false;
  });

  it("copies the source link directly on desktop", async () => {
    const wrapper = mountButton();
    await wrapper.get('[aria-label="provider_links.copy"]').trigger("click");
    expect(copyProviderLink).toHaveBeenCalledWith(url);
    expect(shareProviderLink).not.toHaveBeenCalled();
  });

  it.each([1, 2])(
    "forwards player styling to the trigger with %i providers",
    async (count) => {
      const mappings = [
        providerMapping({ provider_domain: "ytmusic", url }),
        providerMapping({
          provider_domain: "spotify",
          url: "https://open.spotify.com/track/123",
        }),
      ].slice(0, count);
      const wrapper = mountButton(mappings);
      await wrapper.setProps({ variant: "ghost-icon", size: "icon-lg" });
      await wrapper.setProps({ class: "player-sharing-test" });
      const trigger = wrapper.get(
        count === 1
          ? '[aria-label="provider_links.copy"]'
          : '[aria-label="provider_links.share"]',
      );
      expect(trigger.classes()).toContain("player-sharing-test");
      expect(wrapper.getComponent(Button).props("variant")).toBe("ghost-icon");
      expect(trigger.get("svg").classes()).toContain("size-4");
    },
  );

  it("offers the native share sheet on mobile", async () => {
    device.mobile = true;
    vi.stubGlobal("navigator", { share: vi.fn() });
    const wrapper = mountButton();
    await wrapper.get('[aria-label="provider_links.share"]').trigger("click");
    expect(shareProviderLink).toHaveBeenCalledWith(url, "Attention");
    expect(copyProviderLink).not.toHaveBeenCalled();
  });

  it("copies on mobile when native sharing is unavailable", async () => {
    device.mobile = true;
    vi.stubGlobal("navigator", {});
    const wrapper = mountButton();
    await wrapper.get('[aria-label="provider_links.copy"]').trigger("click");
    expect(copyProviderLink).toHaveBeenCalledWith(url);
    expect(shareProviderLink).not.toHaveBeenCalled();
  });

  it("offers each provider in a menu above the fullscreen player", async () => {
    const spotifyUrl = "https://open.spotify.com/track/123";
    const wrapper = mountButton(
      [
        providerMapping({ provider_domain: "ytmusic", url }),
        providerMapping({ provider_domain: "spotify", url: spotifyUrl }),
      ],
      true,
    );
    await wrapper
      .get('[aria-label="provider_links.share"]')
      .trigger("keydown", { key: "Enter" });
    await flushPromises();
    const menu = document.body.querySelector('[role="menu"]');
    expect(menu).not.toBeNull();
    expect(menu?.classList.contains("z-[100001]")).toBe(true);
    const choices = [
      ...document.body.querySelectorAll<HTMLElement>('[role="menuitem"]'),
    ];
    expect(choices.map((choice) => choice.textContent?.trim())).toEqual([
      "provider_links.copy_from: YouTube Music",
      "provider_links.copy_from: Spotify",
    ]);
    choices[1].click();
    await flushPromises();
    expect(copyProviderLink).toHaveBeenCalledWith(spotifyUrl);
    expect(shareProviderLink).not.toHaveBeenCalled();
  });

  it("hides sharing when the item has no public website link", () => {
    expect(mountButton([providerMapping()]).find("button").exists()).toBe(
      false,
    );
  });
});
