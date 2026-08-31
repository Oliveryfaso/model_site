import { cleanup, render } from "@testing-library/react"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AtmosphereBackground } from "./AtmosphereBackground"

describe("AtmosphereBackground", () => {
  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("exposes each exhibit palette color to its decorative canvas", () => {
    // JSDOM does not implement the 2D rendering context. The component's DOM
    // contract remains real; this only prevents the browser API warning.
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)

    const { container } = render(
      <AtmosphereBackground palette={["#120d09", "#b7834e", "#e4b56d"]} motion="edge-bloom" />,
    )
    const canvas = container.querySelector("canvas")

    expect(canvas).toHaveAttribute("aria-hidden", "true")
    expect(canvas).toHaveStyle({
      "--atmosphere-base": "#120d09",
      "--atmosphere-primary": "#b7834e",
      "--atmosphere-accent": "#e4b56d",
    })
  })
})
