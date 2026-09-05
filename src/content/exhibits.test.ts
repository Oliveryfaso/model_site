import { describe, expect, it } from "vitest"
import { exhibits } from "./exhibits"
import { validateExhibits } from "./validateExhibits"

describe("sample exhibit catalog", () => {
  it("contains five unique exhibits with Marina Bay as the sole featured item", () => {
    const result = validateExhibits(exhibits, () => true)
    expect(result.errors).toEqual([])
    expect(exhibits).toHaveLength(5)
    expect(exhibits.filter((item) => item.featured)).toHaveLength(1)
    expect(exhibits.find((item) => item.featured)?.slug).toBe("singapore-marina-bay")
    expect(new Set(exhibits.map((item) => item.presentation.layout)).size).toBe(3)
    expect(new Set(exhibits.map((item) => item.presentation.scene)).size).toBe(3)
  })
})
