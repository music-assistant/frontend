/**
 * The tint pass stands in for a CSS layer that had a 1.5s eased colour
 * transition, so the envelope it drives is the part that has to behave: the
 * first colour arriving without a fade from black, a later colour easing
 * across, and an interrupted transition continuing from wherever it stands
 * rather than snapping. The shader itself is not exercisable here; the
 * uniforms handed to it are.
 */
import { beforeEach, describe, expect, it, vi } from "vitest";
import { createTintPass } from "./tintPass";

const TRANSITION_MS = 1500;

let failing: "none" | "compile" | "link" = "none";

function makeContext() {
  return {
    VERTEX_SHADER: 1,
    FRAGMENT_SHADER: 2,
    COMPILE_STATUS: 3,
    LINK_STATUS: 4,
    TEXTURE_2D: 5,
    TEXTURE_MIN_FILTER: 6,
    TEXTURE_MAG_FILTER: 7,
    TEXTURE_WRAP_S: 8,
    TEXTURE_WRAP_T: 9,
    LINEAR: 10,
    CLAMP_TO_EDGE: 11,
    RGBA: 12,
    UNSIGNED_BYTE: 13,
    TRIANGLES: 14,
    UNPACK_FLIP_Y_WEBGL: 15,
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => failing !== "compile"),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => failing !== "link"),
    deleteProgram: vi.fn(),
    createTexture: vi.fn(() => ({})),
    deleteTexture: vi.fn(),
    bindTexture: vi.fn(),
    texParameteri: vi.fn(),
    pixelStorei: vi.fn(),
    texImage2D: vi.fn(),
    getUniformLocation: vi.fn((_: unknown, name: string) => name),
    viewport: vi.fn(),
    useProgram: vi.fn(),
    uniform3f: vi.fn(),
    uniform1f: vi.fn(),
    drawArrays: vi.fn(),
  };
}

type StubGl = ReturnType<typeof makeContext>;
let gl: StubGl;

const stubContext = () => (gl = makeContext());

const canvas = () => {
  const element = document.createElement("canvas");
  element.getContext = vi.fn((type: string) =>
    type === "webgl2" ? stubContext() : null,
  ) as unknown as HTMLCanvasElement["getContext"];
  return element;
};

const source = () => {
  const element = document.createElement("canvas");
  element.width = 640;
  element.height = 640;
  return element;
};

// The uniforms as the last draw set them.
const lastTint = () => gl.uniform3f.mock.lastCall!.slice(1) as number[];
const lastAmount = () => gl.uniform1f.mock.lastCall![1] as number;

describe("createTintPass", () => {
  beforeEach(() => {
    failing = "none";
  });

  it("returns null without a WebGL2 context, so the caller can fall back", () => {
    const element = document.createElement("canvas");
    element.getContext = vi.fn(
      () => null,
    ) as unknown as HTMLCanvasElement["getContext"];
    expect(createTintPass(element)).toBeNull();
  });

  it("strands nothing on the canvas context when the program fails to link", () => {
    failing = "link";
    const element = canvas();
    expect(createTintPass(element)).toBeNull();
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
  });

  it("cleans up both shaders when one fails to compile", () => {
    failing = "compile";
    const element = canvas();
    expect(createTintPass(element)).toBeNull();
  });

  it("jumps straight to the first colour and only fades the strength in", () => {
    const pass = createTintPass(canvas())!;
    pass.setTint([255, 0, 128]);
    pass.draw(source(), 0);
    // colour is already there, as the CSS layer's v-if was
    expect(lastTint()).toEqual([1, 0, 128 / 255]);
    expect(lastAmount()).toBe(0);

    pass.draw(source(), TRANSITION_MS);
    expect(lastAmount()).toBe(1);
  });

  it("eases a later colour across the transition", () => {
    const pass = createTintPass(canvas())!;
    pass.setTint([0, 0, 0]);
    pass.draw(source(), 0);
    pass.draw(source(), TRANSITION_MS);

    pass.setTint([255, 255, 255]);
    pass.draw(source(), TRANSITION_MS);
    expect(lastTint()).toEqual([0, 0, 0]);

    // smoothstep is symmetric, so the halfway point sits at exactly 0.5
    pass.draw(source(), TRANSITION_MS * 1.5);
    expect(lastTint()[0]).toBeCloseTo(0.5, 6);

    pass.draw(source(), TRANSITION_MS * 2);
    expect(lastTint()).toEqual([1, 1, 1]);
  });

  it("continues an interrupted transition from where it stands", () => {
    const pass = createTintPass(canvas())!;
    pass.setTint([0, 0, 0]);
    pass.draw(source(), 0);
    pass.draw(source(), TRANSITION_MS);

    pass.setTint([255, 255, 255]);
    pass.draw(source(), TRANSITION_MS);
    pass.draw(source(), TRANSITION_MS * 1.5);
    const interruptedAt = lastTint()[0];

    // a third colour mid-fade must start from the current value, not from white
    pass.setTint([0, 0, 0]);
    pass.draw(source(), TRANSITION_MS * 1.5);
    expect(lastTint()[0]).toBeCloseTo(interruptedAt, 6);

    pass.draw(source(), TRANSITION_MS * 3);
    expect(lastTint()[0]).toBeCloseTo(0, 6);
  });

  it("fades the strength out on a null tint without touching the colour", () => {
    const pass = createTintPass(canvas())!;
    pass.setTint([255, 0, 0]);
    pass.draw(source(), 0);
    pass.draw(source(), TRANSITION_MS);
    expect(lastAmount()).toBe(1);

    pass.setTint(null);
    pass.draw(source(), TRANSITION_MS);
    pass.draw(source(), TRANSITION_MS * 2);
    expect(lastAmount()).toBe(0);
    expect(lastTint()).toEqual([1, 0, 0]);
  });

  it("follows the source canvas size", () => {
    const element = canvas();
    const pass = createTintPass(element)!;
    const src = source();
    pass.draw(src, 0);
    expect([element.width, element.height]).toEqual([640, 640]);

    src.width = 320;
    src.height = 320;
    pass.draw(src, 0);
    expect([element.width, element.height]).toEqual([320, 320]);
    expect(gl.viewport).toHaveBeenLastCalledWith(0, 0, 320, 320);
  });

  it("releases its GL objects on destroy", () => {
    const pass = createTintPass(canvas())!;
    pass.destroy();
    expect(gl.deleteTexture).toHaveBeenCalledTimes(1);
    expect(gl.deleteProgram).toHaveBeenCalledTimes(1);
    expect(gl.deleteShader).toHaveBeenCalledTimes(2);
  });
});
