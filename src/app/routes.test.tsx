import { cleanup, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"

vi.mock("../content/exhibits", () => ({ exhibits: [] as const }))

import { appRoutes } from "./routes"

function renderRoute(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

describe("app routes", () => {
  afterEach(() => {
    cleanup()
  })

  it("renders the empty collection at the root", async () => {
    renderRoute("/")

    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "馆藏正在整理中" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "返回馆藏" })).toHaveAttribute("href", "/")
  })

  it("keeps the shell title out of the page heading hierarchy", async () => {
    renderRoute("/")

    expect(
      await screen.findByRole("heading", { level: 1, name: "馆藏正在整理中" }),
    ).toBeInTheDocument()
    expect(
      screen.queryByRole("heading", { level: 2, name: "电子手办收藏站" }),
    ).not.toBeInTheDocument()
  })

  it("renders the about page", async () => {
    renderRoute("/about/")

    expect(
      await screen.findByRole("heading", { name: "关于这个收藏站" }),
    ).toBeInTheDocument()
  })

  it("renders a designed not-found state", async () => {
    renderRoute("/missing/")

    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("heading", { name: "没有找到这件藏品" })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "回到馆藏" })).toHaveAttribute("href", "/")
  })

  it("places the skip link before the site navigation in keyboard order", async () => {
    const user = userEvent.setup()
    renderRoute("/")

    await user.tab()
    expect(screen.getByRole("link", { name: "跳到主要内容" })).toHaveFocus()

    await user.tab()
    await user.tab()
    expect(screen.getByRole("link", { name: "馆藏" })).toHaveFocus()
  })
})
