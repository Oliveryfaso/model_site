import { describe, expect, it, vi } from "vitest"
import type { Exhibit } from "../content/types"
import { shareExhibit, type ShareEnvironment } from "./shareExhibit"

const exhibit: Exhibit = {
  slug: "green-core",
  collectionNumber: "001",
  title: "翠核标本",
  summary: "一枚被当作未知生命核心保存的绿色标本。",
  description: "完整介绍。",
  tags: ["有机"],
  cover: "/covers/avocado.jpg",
  model: "/models/avocado.glb",
  presentation: {
    layout: "center-stage",
    scene: "warm-cabinet",
    palette: ["#263d1f", "#92b85c", "#b47b3e"],
    lightingPresets: ["warm"],
  },
}

function environment(overrides: Partial<ShareEnvironment> = {}): ShareEnvironment {
  return {
    origin: "https://gallery.example/",
    canNativeShare: false,
    share: vi.fn().mockResolvedValue(undefined),
    writeText: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

describe("shareExhibit", () => {
  it("uses native sharing with a normalized canonical exhibit URL", async () => {
    const env = environment({ canNativeShare: true })

    await expect(shareExhibit(exhibit, env)).resolves.toBe("shared")
    expect(env.share).toHaveBeenCalledWith({
      title: "翠核标本",
      text: "一枚被当作未知生命核心保存的绿色标本。",
      url: "https://gallery.example/exhibits/green-core/",
    })
    expect(env.writeText).not.toHaveBeenCalled()
  })

  it("copies the canonical URL when native sharing is unavailable", async () => {
    const env = environment({ origin: "https://gallery.example" })

    await expect(shareExhibit(exhibit, env)).resolves.toBe("copied")
    expect(env.writeText).toHaveBeenCalledWith(
      "https://gallery.example/exhibits/green-core/",
    )
  })

  it("encodes the exhibit slug as one URL path segment", async () => {
    const env = environment({ origin: "https://gallery.example///" })

    await shareExhibit({ ...exhibit, slug: "稀有/核心" }, env)

    expect(env.writeText).toHaveBeenCalledWith(
      "https://gallery.example/exhibits/%E7%A8%80%E6%9C%89%2F%E6%A0%B8%E5%BF%83/",
    )
  })

  it("treats an aborted native share as a cancellation", async () => {
    const env = environment({
      canNativeShare: true,
      share: vi.fn().mockRejectedValue(new DOMException("Share cancelled", "AbortError")),
    })

    await expect(shareExhibit(exhibit, env)).resolves.toBe("cancelled")
    expect(env.writeText).not.toHaveBeenCalled()
  })

  it("falls back to copying after a non-abort native-share failure", async () => {
    const env = environment({
      canNativeShare: true,
      share: vi.fn().mockRejectedValue(new Error("Native share unavailable")),
    })

    await expect(shareExhibit(exhibit, env)).resolves.toBe("copied")
    expect(env.writeText).toHaveBeenCalledWith(
      "https://gallery.example/exhibits/green-core/",
    )
  })
})
