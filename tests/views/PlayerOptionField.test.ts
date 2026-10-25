import { type DOMWrapper, flushPromises, mount } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { PlayerOption, PlayerOptionType } from "@/plugins/api/interfaces";
import PlayerOptionField from "@/views/settings/PlayerOptionField.vue";

const { apiMock } = vi.hoisted(() => ({
  apiMock: { playerCommandSetOption: vi.fn(async () => undefined) },
}));

vi.mock("@/plugins/api", () => ({ api: apiMock, default: apiMock }));

beforeEach(() => {
  vi.clearAllMocks();
});

function mountField(overrides: Partial<PlayerOption>) {
  return mount(PlayerOptionField, {
    props: {
      playerId: "kitchen",
      playerOption: {
        key: "volume_limit",
        name: "Volume limit",
        type: PlayerOptionType.INTEGER,
        translation_key: "volume_limit",
        value: 50,
        read_only: false,
        min_value: null,
        max_value: 100,
        step: null,
        options: null,
        ...overrides,
      },
    },
  });
}

// one input event per keystroke; setValue would also fire change, which only
// leaving the field or pressing Enter does
async function typeInto(
  input: Omit<DOMWrapper<HTMLInputElement>, "exists">,
  text: string,
) {
  for (let i = 1; i <= text.length; i++) {
    input.element.value = text.slice(0, i);
    await input.trigger("input");
  }
}

describe("PlayerOptionField", () => {
  it.each([
    { type: PlayerOptionType.INTEGER, value: 50, typed: "80", sent: 80 },
    {
      type: PlayerOptionType.STRING,
      value: "Den",
      typed: "Kitchen",
      sent: "Kitchen",
    },
  ])(
    "sends a typed $type once the field is left",
    async ({ type, value, typed, sent }) => {
      const wrapper = mountField({ type, value });
      const input = wrapper.get("input");

      await typeInto(input, typed);
      expect(apiMock.playerCommandSetOption).not.toHaveBeenCalled();

      await input.trigger("change");

      expect(apiMock.playerCommandSetOption).toHaveBeenCalledExactlyOnceWith(
        "kitchen",
        "volume_limit",
        sent,
      );
    },
  );

  it("puts the player's value back when the typed one cannot be sent", async () => {
    apiMock.playerCommandSetOption.mockRejectedValueOnce(new Error("refused"));
    const wrapper = mountField({});
    const input = wrapper.get("input");

    await typeInto(input, "abc");
    await input.trigger("change");
    expect(apiMock.playerCommandSetOption).not.toHaveBeenCalled();
    expect(input.element.value).toBe("50");

    await typeInto(input, "80");
    await input.trigger("change");
    await flushPromises();
    expect(input.element.value).toBe("50");
  });
});
