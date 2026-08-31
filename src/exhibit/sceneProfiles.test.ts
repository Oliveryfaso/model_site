import { describe, expect, it } from "vitest"
import { sceneProfiles } from "./sceneProfiles"
import { resolvePerformanceTier } from "./usePerformanceTier"

describe("sceneProfiles", () => {
  it("provides a profile for every configured scene", () => {
    expect(Object.keys(sceneProfiles).sort()).toEqual([
      "cold-chamber",
      "star-mist",
      "warm-cabinet",
    ])
  })

  it("keeps each exhibit scene within its intended camera, lighting, and mobile limits", () => {
    expect(sceneProfiles["warm-cabinet"].defaultCamera.position).toEqual([0, 0.4, 4.2])
    expect(sceneProfiles["star-mist"].mobile.disableParticles).toBe(true)
    expect(sceneProfiles["cold-chamber"].allowedLighting).toEqual(["top", "scan"])
  })
})

describe("resolvePerformanceTier", () => {
  it("caps a mobile scene at its configured DPR and shadow policy", () => {
    expect(
      resolvePerformanceTier(sceneProfiles["star-mist"], {
        mobile: true,
        deviceMemory: 8,
        devicePixelRatio: 3,
      }),
    ).toEqual({ mobile: true, dpr: [1, 1.25], shadows: false })
  })

  it("uses a conservative tier when device memory is low", () => {
    expect(
      resolvePerformanceTier(sceneProfiles["warm-cabinet"], {
        mobile: false,
        deviceMemory: 2,
        devicePixelRatio: 2,
      }),
    ).toEqual({ mobile: false, dpr: [1, 1], shadows: false })
  })
})
