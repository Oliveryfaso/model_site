import { describe, expect, it } from "vitest"
import type { Exhibit } from "../content/types"
import { resolveAtmospherePalette } from "./atmosphere"

const exhibit = {
  presentation: {
    palette: ["#241b16", "#b7834e", "#e4b56d"],
  },
} as unknown as Exhibit

describe("resolveAtmospherePalette", () => {
  it("maps the exhibit palette into atmosphere colors", () => {
    expect(resolveAtmospherePalette(exhibit)).toEqual({
      base: "#241b16",
      shadow: "#241b16",
      primary: "#b7834e",
      accent: "#e4b56d",
    })
    expect(resolveAtmospherePalette(exhibit).primary).not.toBe("#00ffff")
  })
})
