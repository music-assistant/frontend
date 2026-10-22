import { flushPromises, shallowMount } from "@vue/test-utils";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { MusicAssistantApi } from "@/plugins/api";
import type { SoundEffect } from "@/plugins/api/interfaces";
import AmbientSoundsCustomSounds from "@/views/settings/AmbientSoundsCustomSounds.vue";
import {
  eventbus,
  type DeleteConfirmationDialogEvent,
} from "@/plugins/eventbus";

const apiMock = vi.hoisted(() => ({
  getProvider: vi.fn(() => ({ domain: "ambient_sounds" })),
  getSoundEffects: vi.fn<MusicAssistantApi["getSoundEffects"]>(),
  removeAmbientSound: vi.fn<MusicAssistantApi["removeAmbientSound"]>(),
}));

vi.mock("@/plugins/api", () => ({
  api: apiMock,
  default: apiMock,
}));
vi.mock("vue-i18n", async (importOriginal) => {
  const actual = await importOriginal<typeof import("vue-i18n")>();
  return {
    ...actual,
    useI18n: () => ({ t: translate }),
  };
});

function translate(key: string, args?: unknown[]): string {
  return args?.length ? `${key}:${args.join(",")}` : key;
}

const sound = {
  item_id: "https://example.com/rain.mp3",
  provider: "ambient_sounds--1",
  name: "Rain",
} as SoundEffect;

async function mountAndClickRemove() {
  const wrapper = shallowMount(AmbientSoundsCustomSounds, {
    global: {
      mocks: { $t: translate },
      stubs: {
        Button: {
          template: "<button @click=\"$emit('click')\"><slot /></button>",
        },
        Card: { template: "<div><slot /></div>" },
        CardContent: { template: "<div><slot /></div>" },
        CardHeader: { template: "<div><slot /></div>" },
      },
    },
  });
  await flushPromises();
  await wrapper.find('button[aria-label="remove"]').trigger("click");
  return wrapper;
}

function lastConfirmation(
  emitSpy: ReturnType<typeof vi.spyOn>,
): DeleteConfirmationDialogEvent | undefined {
  const calls = emitSpy.mock.calls as [string, DeleteConfirmationDialogEvent][];
  return calls.find(([event]) => event === "deleteConfirmationDialog")?.[1];
}

describe("AmbientSoundsCustomSounds", () => {
  beforeEach(() => {
    apiMock.getSoundEffects.mockResolvedValue([sound]);
    apiMock.removeAmbientSound.mockResolvedValue();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
  });

  it("asks for confirmation naming the sound before removing it", async () => {
    const emitSpy = vi.spyOn(eventbus, "emit");

    await mountAndClickRemove();

    const confirmation = lastConfirmation(emitSpy);
    expect(confirmation?.message).toBe(
      "audio_overlay_remove_custom_confirm:Rain",
    );
    expect(apiMock.removeAmbientSound).not.toHaveBeenCalled();
  });

  it("removes the sound and reloads the list once confirmed", async () => {
    const emitSpy = vi.spyOn(eventbus, "emit");
    await mountAndClickRemove();
    apiMock.getSoundEffects.mockClear();

    await lastConfirmation(emitSpy)?.onConfirm();

    expect(apiMock.removeAmbientSound).toHaveBeenCalledWith(sound.item_id);
    expect(apiMock.getSoundEffects).toHaveBeenCalledTimes(1);
  });
});
