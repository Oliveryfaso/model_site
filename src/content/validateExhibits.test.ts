import { describe, expect, it, vi } from "vitest"
import type { Exhibit } from "./types"
import { getFeaturedExhibit, getExhibitBySlug } from "./catalog"
import { validateExhibits } from "./validateExhibits"

const exhibit: Exhibit = {
  slug: "sample-one",
  collectionNumber: "001",
  title: "样本一号",
  summary: "用于验证馆藏数据的一件样本。",
  description: "完整介绍。",
  tags: ["样本"],
  cover: "/covers/sample-one.jpg",
  model: "/models/sample-one.glb",
  featured: true,
  presentation: {
    layout: "center-stage",
    scene: "warm-cabinet",
    palette: ["#263d1f", "#92b85c", "#b47b3e"],
    lightingPresets: ["warm", "rim"],
  },
}

describe("exhibit catalog", () => {
  it("rejects duplicate slugs", () => {
    const result = validateExhibits([exhibit, { ...exhibit, collectionNumber: "002" }], () => true)
    expect(result.errors).toContain("Duplicate exhibit slug: sample-one")
  })

  it("rejects missing required assets", () => {
    const result = validateExhibits([exhibit], (path) => path !== exhibit.model)
    expect(result.errors).toContain("Missing model asset: /models/sample-one.glb")
  })

  it("rejects a missing configured ambient track", () => {
    const ambientTrack = "/audio/sample-one.wav"
    const result = validateExhibits(
      [{ ...exhibit, audio: { ambientTrack } }],
      (path) => path !== ambientTrack,
    )

    expect(result.errors).toContain("Missing audio asset: /audio/sample-one.wav")
  })

  it("rejects an exactly configured missing share image", () => {
    const shareImage = "/share/missing.png"
    const result = validateExhibits(
      [{ ...exhibit, share: { image: shareImage } }],
      (path) => path !== shareImage,
    )

    expect(result.errors).toContain("Missing share image asset: /share/missing.png")
  })

  it("rejects an exactly configured missing collection theme", () => {
    const themeTrack = "/audio/missing-theme.wav"
    const result = validateExhibits(
      [exhibit],
      (path) => path !== themeTrack,
      { themeTrack },
    )

    expect(result.errors).toContain("Missing theme audio asset: /audio/missing-theme.wav")
  })

  it.each([
    ["slug", { slug: "   " }, "entry 1"],
    ["collectionNumber", { collectionNumber: "\t" }, "sample-one"],
    ["title", { title: " " }, "sample-one"],
    ["summary", { summary: "\n" }, "sample-one"],
    ["description", { description: "  " }, "sample-one"],
    ["cover", { cover: " " }, "sample-one"],
    ["model", { model: "\t" }, "sample-one"],
  ] as const)("rejects a blank required %s", (field, overrides, label) => {
    const result = validateExhibits([{ ...exhibit, ...overrides }], () => true)

    expect(result.errors).toContain(`Blank required exhibit field: ${field} (${label})`)
  })

  it("rejects empty and blank tags", () => {
    const empty = validateExhibits([{ ...exhibit, tags: [] }], () => true)
    const blank = validateExhibits([{ ...exhibit, tags: ["样本", "  "] }], () => true)

    expect(empty.errors).toContain("Empty exhibit tags: sample-one")
    expect(blank.errors).toContain("Blank exhibit tag at index 1: sample-one")
  })

  it.each([
    ["https://cdn.example/cover.jpg", exhibit.model, "Invalid local cover path: https://cdn.example/cover.jpg"],
    ["//cdn.example/cover.jpg", exhibit.model, "Invalid local cover path: //cdn.example/cover.jpg"],
    ["/covers/../secret.jpg", exhibit.model, "Invalid local cover path: /covers/../secret.jpg"],
    ["/covers/%2e%2e/secret.jpg", exhibit.model, "Invalid local cover path: /covers/%2e%2e/secret.jpg"],
    [exhibit.cover, "models/sample-one.glb", "Invalid local model path: models/sample-one.glb"],
    [exhibit.cover, "/models/sample-one.glb?download=1", "Invalid local model path: /models/sample-one.glb?download=1"],
  ] as const)("rejects unsafe public asset paths %#", (cover, model, message) => {
    const assetIsFile = vi.fn(() => true)
    const result = validateExhibits([{ ...exhibit, cover, model }], assetIsFile)

    expect(result.errors).toContain(message)
    expect(assetIsFile).not.toHaveBeenCalledWith(message.split(": ").slice(1).join(": "))
  })

  it("rejects a non-GLB model path", () => {
    const result = validateExhibits(
      [{ ...exhibit, model: "/models/sample-one.gltf" }],
      () => true,
    )

    expect(result.errors).toContain("Model asset must use .glb: /models/sample-one.gltf")
  })

  it("rejects unsafe optional share, exhibit-audio, and theme-audio paths", () => {
    const result = validateExhibits(
      [
        {
          ...exhibit,
          audio: { ambientTrack: "../audio/ambient.wav" },
          share: { image: "data:image/png;base64,unsafe" },
        },
      ],
      () => true,
      { themeTrack: "https://cdn.example/theme.wav" },
    )

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Invalid local theme audio path: https://cdn.example/theme.wav",
        "Invalid local audio path: ../audio/ambient.wav",
        "Invalid local share image path: data:image/png;base64,unsafe",
      ]),
    )
  })

  it("rejects unsafe slugs and unknown presentation identifiers", () => {
    const result = validateExhibits(
      [
        {
          ...exhibit,
          slug: "Bad Slug/../escape",
          presentation: {
            layout: "dashboard" as Exhibit["presentation"]["layout"],
            scene: "unknown-scene" as Exhibit["presentation"]["scene"],
            palette: ["#123456", "#abcdef", "#fedcba"],
            lightingPresets: ["laser" as Exhibit["presentation"]["lightingPresets"][number]],
          },
        },
      ],
      () => true,
    )

    expect(result.errors).toEqual(
      expect.arrayContaining([
        "Invalid exhibit slug: Bad Slug/../escape",
        "Unknown exhibit layout: dashboard (Bad Slug/../escape)",
        "Unknown scene: unknown-scene (Bad Slug/../escape)",
        "Unknown lighting preset: laser (Bad Slug/../escape)",
      ]),
    )
  })

  it("requires exactly three hexadecimal atmosphere colors", () => {
    const missing = validateExhibits([
      { ...exhibit, presentation: { ...exhibit.presentation, palette: undefined } } as unknown as Exhibit,
    ], () => true)
    const valid = validateExhibits(
      [{
        ...exhibit,
        presentation: {
          ...exhibit.presentation,
          palette: ["#123456", "#abcdef", "#fedcba"],
        },
      }],
      () => true,
    )
    const invalidHex = validateExhibits(
      [{
        ...exhibit,
        presentation: {
          ...exhibit.presentation,
          palette: ["#123456", "lime", "#fedcba"] as unknown,
        } as Exhibit["presentation"],
      }],
      () => true,
    )
    const invalidCardinality = validateExhibits(
      [{
        ...exhibit,
        presentation: {
          ...exhibit.presentation,
          palette: ["#123456", "#abcdef"] as unknown,
        } as Exhibit["presentation"],
      }],
      () => true,
    )

    expect(missing.errors).toContain("Missing exhibit atmosphere palette: sample-one")
    expect(valid.errors).not.toContain("Invalid exhibit atmosphere palette: sample-one")
    expect(invalidHex.errors).toContain("Invalid exhibit atmosphere palette: sample-one")
    expect(invalidCardinality.errors).toContain("Invalid exhibit atmosphere palette: sample-one")
  })

  it("finds an exhibit and the sole featured exhibit", () => {
    expect(getExhibitBySlug("sample-one", [exhibit])).toEqual(exhibit)
    expect(getFeaturedExhibit([exhibit])).toEqual(exhibit)
  })
})
