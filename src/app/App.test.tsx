import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { App } from "./App"

describe("App", () => {
  it("renders the configured collection title as site branding", () => {
    render(<App />)
    expect(screen.getByRole("link", { name: "电子手办收藏站" })).toBeInTheDocument()
  })
})
