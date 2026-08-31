import { describe, expect, it } from "vitest"
import { exhibits } from "./exhibits"
import { validateExhibits } from "./validateExhibits"

describe("sample exhibit catalog", () => {
  it("contains three unique exhibits and one featured item", () => {
    const result = validateExhibits(exhibits, () => true)
    expect(result.errors).toEqual([])
    expect(exhibits).toHaveLength(3)
    expect(exhibits.filter((item) => item.featured)).toHaveLength(1)
    expect(new Set(exhibits.map((item) => item.presentation.layout)).size).toBe(3)
    expect(new Set(exhibits.map((item) => item.presentation.scene)).size).toBe(3)
  })
})
