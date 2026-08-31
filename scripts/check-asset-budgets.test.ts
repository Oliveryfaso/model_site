import { describe, expect, it, vi } from "vitest"
import { siteConfig } from "../src/app/siteConfig"
import type { Exhibit } from "../src/content/types"
import { checkAssetBudgets } from "./check-asset-budgets"

const MIB = 1024 * 1024
const KIB = 1024
const publicDir = "/virtual/public"

function makeExhibit(overrides: Partial<Exhibit> = {}): Exhibit {
  return {
    slug: "heavy",
    collectionNumber: "001",
    title: "Heavy",
    summary: "Summary",
    description: "Description",
    tags: ["tag"],
    cover: "/covers/home.jpg",
    model: "/models/heavy.glb",
    featured: true,
    presentation: {
      layout: "center-stage",
      scene: "warm-cabinet",
      palette: ["#263d1f", "#92b85c", "#b47b3e"],
      lightingPresets: ["warm"],
    },
    share: { image: "/share/heavy.png" },
    audio: { ambientTrack: "/audio/ambient.mp3" },
    ...overrides,
  }
}

function statFrom(sizes: Record<string, number>) {
  return vi.fn((absolutePath: string) => {
    const publicPath = absolutePath.slice(publicDir.length)
    const size = sizes[publicPath]
    if (size === undefined) throw Object.assign(new Error("missing"), { code: "ENOENT" })
    return size
  })
}

describe("checkAssetBudgets", () => {
  it("warns one byte above each exact threshold, including theme and exhibit audio", () => {
    const findings = checkAssetBudgets(
      publicDir,
      [makeExhibit()],
      statFrom({
        "/models/heavy.glb": 25 * MIB + 1,
        "/covers/home.jpg": 300 * KIB + 1,
        "/share/heavy.png": MIB + 1,
        [siteConfig.themeTrack]: 3 * MIB + 1,
        "/audio/ambient.mp3": 3 * MIB + 1,
      }),
    )

    expect(findings).toEqual([
      {
        level: "warning",
        path: "/models/heavy.glb",
        message: "GLB exceeds 25 MB warning threshold",
      },
      {
        level: "warning",
        path: "/covers/home.jpg",
        message: "Homepage cover exceeds 300 KiB warning threshold",
      },
      {
        level: "warning",
        path: "/share/heavy.png",
        message: "Share image exceeds 1 MiB warning threshold",
      },
      {
        level: "warning",
        path: siteConfig.themeTrack,
        message: "Audio exceeds 3 MiB warning threshold",
      },
      {
        level: "warning",
        path: "/audio/ambient.mp3",
        message: "Audio exceeds 3 MiB warning threshold",
      },
    ])
  })

  it("does not warn at the exact boundaries", () => {
    const findings = checkAssetBudgets(
      publicDir,
      [makeExhibit()],
      statFrom({
        "/models/heavy.glb": 25 * MIB,
        "/covers/home.jpg": 300 * KIB,
        "/share/heavy.png": MIB,
        [siteConfig.themeTrack]: 3 * MIB,
        "/audio/ambient.mp3": 3 * MIB,
      }),
    )

    expect(findings).toEqual([])
  })

  it("checks the first exhibit cover when the homepage has no explicit feature", () => {
    const findings = checkAssetBudgets(
      publicDir,
      [makeExhibit({ featured: false })],
      statFrom({
        "/models/heavy.glb": 1,
        "/covers/home.jpg": 300 * KIB + 1,
        "/share/heavy.png": 1,
        [siteConfig.themeTrack]: 1,
        "/audio/ambient.mp3": 1,
      }),
    )

    expect(findings).toContainEqual({
      level: "warning",
      path: "/covers/home.jpg",
      message: "Homepage cover exceeds 300 KiB warning threshold",
    })
  })

  it("checks every cover rendered on the homepage, including non-featured exhibits", () => {
    const findings = checkAssetBudgets(
      publicDir,
      [
        makeExhibit(),
        makeExhibit({
          slug: "secondary",
          collectionNumber: "002",
          cover: "/covers/secondary.jpg",
          featured: false,
        }),
      ],
      statFrom({
        "/models/heavy.glb": 1,
        "/covers/home.jpg": 1,
        "/covers/secondary.jpg": 300 * KIB + 1,
        "/share/heavy.png": 1,
        [siteConfig.themeTrack]: 1,
        "/audio/ambient.mp3": 1,
      }),
    )

    expect(findings).toContainEqual({
      level: "warning",
      path: "/covers/secondary.jpg",
      message: "Homepage cover exceeds 300 KiB warning threshold",
    })
  })

  it("deduplicates identical public paths and ignores missing assets", () => {
    const statSize = statFrom({
      "/models/shared.glb": 25 * MIB + 1,
      [siteConfig.themeTrack]: 3 * MIB + 1,
    })
    const exhibits = [
      makeExhibit({
        model: "/models/shared.glb",
        cover: "/covers/missing.jpg",
        audio: { ambientTrack: siteConfig.themeTrack },
      }),
      makeExhibit({
        slug: "duplicate",
        model: "/models/shared.glb",
        featured: false,
        audio: { ambientTrack: siteConfig.themeTrack },
      }),
    ]

    const findings = checkAssetBudgets(publicDir, exhibits, statSize)

    expect(findings.map((finding) => finding.path)).toEqual([
      "/models/shared.glb",
      siteConfig.themeTrack,
    ])
    const statPaths = statSize.mock.calls.map(([absolutePath]) => absolutePath)
    expect(new Set(statPaths).size).toBe(statPaths.length)
    expect(statSize).toHaveBeenCalledTimes(5)
  })

  it("uses the strictest applicable category when one path has multiple roles", () => {
    const statSize = statFrom({ "/shared.bin": 301 * KIB })
    const shared = makeExhibit({
      model: "/shared.bin",
      cover: "/shared.bin",
      share: undefined,
      audio: undefined,
    })

    const findings = checkAssetBudgets(publicDir, [shared], statSize)

    expect(findings).toContainEqual({
      level: "warning",
      path: "/shared.bin",
      message: "Homepage cover exceeds 300 KiB warning threshold",
    })
    expect(statSize).toHaveBeenCalledTimes(2)
  })

  it("stats lexical aliases of the same in-root path once", () => {
    const statSize = statFrom({
      "/shared.glb": 1,
        [siteConfig.themeTrack]: 1,
    })
    const findings = checkAssetBudgets(
      publicDir,
      [
        makeExhibit({
          model: "/models/../shared.glb",
          cover: "/covers/missing.jpg",
          share: undefined,
          audio: undefined,
        }),
        makeExhibit({
          slug: "alias",
          model: "/shared.glb",
          featured: false,
          share: undefined,
          audio: undefined,
        }),
      ],
      statSize,
    )

    expect(findings).toEqual([])
    const statPaths = statSize.mock.calls.map(([absolutePath]) => absolutePath)
    expect(new Set(statPaths).size).toBe(statPaths.length)
    expect(statSize).toHaveBeenCalledTimes(4)
  })
})
