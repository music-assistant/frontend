import {
  addHassControlEntity,
  getHassProviderInstance,
} from "@/helpers/hass_controls";
import type { MusicAssistantApi } from "@/plugins/api";
import {
  ConfigEntryType,
  ProviderStage,
  ProviderType,
  type ProviderConfig,
} from "@/plugins/api/interfaces";
import { beforeEach, describe, expect, it, vi } from "vitest";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    providers: {} as Record<
      string,
      { instance_id: string; domain: string; available: boolean }
    >,
    getProviderConfig: vi.fn<MusicAssistantApi["getProviderConfig"]>(),
    saveProviderConfig: vi.fn<MusicAssistantApi["saveProviderConfig"]>(),
  },
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));

describe("getHassProviderInstance", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.providers = {};
  });

  it("finds the available Home Assistant provider", () => {
    apiMock.providers = {
      "spotify--1": {
        instance_id: "spotify--1",
        domain: "spotify",
        available: true,
      },
      "hass--1": { instance_id: "hass--1", domain: "hass", available: true },
    };

    expect(getHassProviderInstance()?.instance_id).toBe("hass--1");
  });

  it("ignores a Home Assistant provider that is not available", () => {
    apiMock.providers = {
      "hass--1": { instance_id: "hass--1", domain: "hass", available: false },
    };

    expect(getHassProviderInstance()).toBeUndefined();
  });
});

describe("addHassControlEntity", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    apiMock.saveProviderConfig.mockResolvedValue(providerConfig(null));
  });

  it("appends the entity to the list the provider already holds", async () => {
    givenControls(["switch.tv"]);

    await addHassControlEntity("hass--1", "power_controls", "switch.amp");

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "hass",
      { power_controls: ["switch.tv", "switch.amp"] },
      "hass--1",
    );
  });

  it("starts the list when the provider holds none", async () => {
    givenControls(null);

    await addHassControlEntity("hass--1", "power_controls", "switch.amp");

    expect(apiMock.saveProviderConfig).toHaveBeenCalledWith(
      "hass",
      { power_controls: ["switch.amp"] },
      "hass--1",
    );
  });

  it("leaves the config untouched for an entity that is already listed", async () => {
    givenControls(["switch.amp"]);

    await addHassControlEntity("hass--1", "power_controls", "switch.amp");

    expect(apiMock.saveProviderConfig).not.toHaveBeenCalled();
  });
});

function givenControls(value: string[] | null) {
  apiMock.getProviderConfig.mockResolvedValue(providerConfig(value));
}

function providerConfig(value: string[] | null): ProviderConfig {
  return {
    type: ProviderType.PLUGIN,
    domain: "hass",
    instance_id: "hass--1",
    enabled: true,
    manifest: {
      type: ProviderType.PLUGIN,
      domain: "hass",
      name: "Home Assistant",
      description: "Home Assistant integration",
      codeowners: [],
      credits: [],
      requirements: [],
      multi_instance: false,
      builtin: false,
      allow_disable: true,
      stage: ProviderStage.STABLE,
      icon_images: [],
    },
    values: {
      power_controls: {
        key: "power_controls",
        type: ConfigEntryType.STRING,
        label: "Power controls",
        default_value: [],
        required: false,
        options: [],
        category: "generic",
        multi_value: true,
        value,
      },
    },
  };
}
