import DSPIRManager from "@/components/dsp/DSPIRManager.vue";
import { MAX_IR_BYTES } from "@/helpers/dspIR";
import type { DSPIRMetadata } from "@/plugins/api/interfaces";
import { flushPromises, mount, type VueWrapper } from "@vue/test-utils";
import { beforeEach, describe, expect, it, vi } from "vitest";

const apiMock = vi.hoisted(() => ({
  uploadDSPIR: vi.fn(),
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

describe("DSPIRManager", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("rejects a file over the size limit without selecting it or uploading", async () => {
    const wrapper = mountManager();

    await selectFile(wrapper, oversizedFile());

    // Derived from the constant, so the message can never name a limit the
    // check does not actually apply.
    expect(wrapper.text()).toContain(
      `This file is larger than the ${MAX_IR_BYTES / 1024 / 1024} MiB limit.`,
    );
    expect(wrapper.text()).toContain("No file selected");
    expect(apiMock.uploadDSPIR).not.toHaveBeenCalled();
  });

  // The server rejects anything bigger, so a higher value here would let a
  // doomed upload through instead of catching it locally.
  it("pins the client-side limit to what the server enforces", () => {
    expect(MAX_IR_BYTES).toBe(10 * 1024 * 1024);
  });

  it("accepts a file at the size limit and uploads it", async () => {
    apiMock.uploadDSPIR.mockResolvedValue(makeIR());
    const wrapper = mountManager();

    await selectFile(wrapper, sizedFile(MAX_IR_BYTES, "impulse.wav"));

    expect(wrapper.text()).not.toContain("larger than");
    expect(wrapper.text()).toContain("impulse.wav");

    uploadButton(wrapper).element.click();
    // Reading the file back is real FileReader work, not a microtask, so
    // wait for it instead of assuming a fixed number of flushes suffices.
    await vi.waitFor(() => expect(apiMock.uploadDSPIR).toHaveBeenCalled());

    expect(apiMock.uploadDSPIR).toHaveBeenCalledWith(
      "impulse",
      expect.any(String),
    );
  });
});

function translate(key: string, params?: unknown): string {
  if (key === "settings.dsp.convolution.too_large" && Array.isArray(params)) {
    return `This file is larger than the ${params[0]} MiB limit.`;
  }
  if (key === "settings.dsp.convolution.no_file") return "No file selected";
  return key;
}

function makeIR(overrides: Partial<DSPIRMetadata> = {}): DSPIRMetadata {
  return {
    ir_id: "ir-1",
    name: "impulse",
    sample_rate: 48000,
    channels: 2,
    duration: 0.53,
    ...overrides,
  };
}

// A real Blob backs this, so readAsDataURL still works; only the reported
// `size` is monkey-patched, which is all the too-large check reads.
function oversizedFile(): File {
  return sizedFile(MAX_IR_BYTES + 1, "impulse.wav");
}

function sizedFile(size: number, name: string): File {
  const file = new File(["fake impulse response"], name, {
    type: "audio/wav",
  });
  Object.defineProperty(file, "size", { value: size });
  return file;
}

function mountManager(): VueWrapper {
  const passthrough = { template: "<div><slot /></div>" };
  return mount(DSPIRManager, {
    props: { irs: [], modelValue: true },
    global: {
      mocks: { $t: translate },
      stubs: {
        Dialog: passthrough,
        DialogContent: passthrough,
        DialogHeader: passthrough,
        DialogTitle: passthrough,
        DialogDescription: true,
        DialogFooter: passthrough,
      },
    },
  });
}

function uploadButton(wrapper: VueWrapper) {
  const button = wrapper
    .findAll("button")
    .find((candidate) =>
      candidate.text().includes("settings.dsp.convolution.upload"),
    );
  if (!button) throw new Error("upload button not found");
  return button;
}

async function selectFile(wrapper: VueWrapper, file: File): Promise<void> {
  const input = wrapper.get('input[type="file"]');
  Object.defineProperty(input.element, "files", { value: [file] });
  await input.trigger("change");
  await flushPromises();
}
