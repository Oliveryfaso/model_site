import { cleanup, render, screen } from "@testing-library/react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, describe, expect, it } from "vitest"
import { createAppRoutes } from "./routes"

function renderRoute(path: string, isDev: boolean) {
  const router = createMemoryRouter(createAppRoutes(isDev), { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe("share-card routes", () => {
  afterEach(cleanup)

  it("renders a capture card only in the development route table", async () => {
    const { container } = renderRoute("/__share-card/green-core/", true)

    expect(await screen.findByRole("heading", { name: "翠核标本" })).toBeInTheDocument()
    expect(container.querySelector("[data-share-card]")).toBeInTheDocument()
  })

  it("does not expose the capture route in the production route table", async () => {
    renderRoute("/__share-card/green-core/", false)

    expect(
      await screen.findByRole("heading", { name: "没有找到这件藏品" }),
    ).toBeInTheDocument()
    expect(screen.queryByText("藏品 001")).not.toBeInTheDocument()
  })
})
