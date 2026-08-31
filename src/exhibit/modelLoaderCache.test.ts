import { describe, expect, it, vi } from "vitest"

const loaderState = vi.hoisted(() => ({
  clear: vi.fn(),
}))

vi.mock("@react-three/drei", () => ({
  useGLTF: Object.assign(vi.fn(), { clear: loaderState.clear }),
}))

import { clearModelLoaderCache } from "./modelLoaderCache"

describe("model loader cache", () => {
  it("clears only the exact failed GLB path", () => {
    clearModelLoaderCache("/models/failed.glb")

    expect(loaderState.clear).toHaveBeenCalledOnce()
    expect(loaderState.clear).toHaveBeenCalledWith("/models/failed.glb")
  })
})
