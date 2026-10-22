/// <reference types="@webgpu/types" />
import { effect, frame, init, sampler, surface, texture, type Texture } from "vgpu";
import { SHADER } from "./shader";

export const pixelRatio = () => Math.min(window.devicePixelRatio || 1, 2);

/** WebGPU surface over `canvas` that draws one picture; null where WebGPU is unavailable. */
export async function createGPU(canvas: HTMLCanvasElement, signal: AbortSignal, onLost: () => void) {
  if (!navigator.gpu || signal.aborted) return null;
  const gpu = await init();
  if (signal.aborted) {
    gpu.dispose();
    return null;
  }
  try {
    const output = surface(gpu, canvas, {
      autoResize: false,
      dpr: pixelRatio(),
      size: [innerWidth, innerHeight],
      alphaMode: "premultiplied",
      clearColor: [0, 0, 0, 0],
    });
    const shader = effect(gpu, SHADER, { label: "Pointer peek" });
    shader.set({ linearSampler: sampler(gpu, { minFilter: "linear", magFilter: "linear" }) });
    const textures = new Set<Texture>();
    const allocate = (width: number, height: number) => {
      const result = texture(gpu, {
        kind: "2d",
        size: [width, height],
        format: "rgba8unorm",
        usage: ["texture_binding", "copy_dst", "render_attachment"],
      });
      textures.add(result);
      return result;
    };
    const blank = allocate(1, 1);
    shader.set({ image: blank });
    await shader.compile({ colors: [output.format] });
    if (signal.aborted) {
      gpu.dispose();
      return null;
    }
    let alive = true;
    gpu.gpu.lost.then((info) => {
      if (alive && info.reason !== "destroyed") onLost();
    });
    const stopErrors = gpu.onError((error) => {
      console.error("Pointer peek GPU:", error);
      if (alive) onLost();
    });
    return {
      upload(image: HTMLImageElement) {
        const target = allocate(image.naturalWidth, image.naturalHeight);
        gpu.gpu.queue.copyExternalImageToTexture({ source: image }, { texture: target.gpu }, target.size);
        return target;
      },
      resize: () => output.resize([Math.round(innerWidth * pixelRatio()), Math.round(innerHeight * pixelRatio())]),
      draw(uniforms: Record<string, number | number[]>, image: Texture) {
        shader.set({ u: uniforms, image });
        frame(gpu, (f) => f.pass(output, shader));
      },
      clear() {
        shader.set({ u: { frame: [0, 0, 0, 0] }, image: blank });
        frame(gpu, (f) => f.pass(output, shader));
      },
      dispose() {
        alive = false;
        stopErrors();
        textures.forEach((item) => item.dispose());
        gpu.dispose();
      },
    };
  } catch (error) {
    gpu.dispose();
    throw error;
  }
}
