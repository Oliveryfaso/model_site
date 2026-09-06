import { cleanup, render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import {
  createMemoryRouter,
  MemoryRouter,
  RouterProvider,
} from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { CollectionPage } from "./CollectionPage"

function findStyleRule(selectorFragment: string): CSSStyleRule | undefined {
  const visit = (rules: CSSRuleList): CSSStyleRule | undefined => {
    for (const rule of rules) {
      if ("selectorText" in rule && String(rule.selectorText).includes(selectorFragment)) {
        return rule as CSSStyleRule
      }
      if ("cssRules" in rule) {
        const nested = visit((rule as CSSGroupingRule).cssRules)
        if (nested) return nested
      }
    }
    return undefined
  }

  for (const sheet of document.styleSheets) {
    const match = visit(sheet.cssRules)
    if (match) return match
  }
  return undefined
}

afterEach(() => {
  cleanup()
  vi.restoreAllMocks()
})

describe("CollectionPage", () => {
  beforeEach(() => {
    vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue(null)
  })

  it("opens with the featured exhibit and derives its atmosphere from the featured palette", () => {
    render(
      <MemoryRouter>
        <CollectionPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("heading", { name: "滨海湾：与你看夜景" })).toBeInTheDocument()
    expect(screen.getAllByRole("article")).toHaveLength(5)
    expect(screen.getByRole("link", { name: /进入滨海湾：与你看夜景展厅/ })).toHaveAttribute(
      "href",
      "/exhibits/singapore-marina-bay/",
    )
    const atmosphere = document.querySelector(".collection-page__atmosphere")
    const canvas = atmosphere?.querySelector("canvas")

    expect(atmosphere).toHaveAttribute("aria-hidden", "true")
    expect(canvas).toHaveClass("atmosphere-background--collection")
    expect(canvas).toHaveStyle({
      "--atmosphere-base": "#101E28",
      "--atmosphere-primary": "#52794D",
      "--atmosphere-accent": "#EDC789",
    })
  })

  it("declares the generated cover geometry and defers non-featured image decoding", () => {
    render(
      <MemoryRouter>
        <CollectionPage />
      </MemoryRouter>,
    )

    expect(screen.getByRole("img", { name: "滨海湾：与你看夜景" })).toHaveAttribute(
      "fetchpriority",
      "high",
    )
    expect(screen.getByRole("img", { name: "滨海湾：与你看夜景" })).toHaveAttribute("width", "1600")
    expect(screen.getByRole("img", { name: "滨海湾：与你看夜景" })).toHaveAttribute("height", "1200")

    const wall = screen.getByRole("region", { name: "馆藏墙" })
    const cardImages = within(wall).getAllByRole("img")
    expect(cardImages).toHaveLength(4)
    for (const image of cardImages) {
      expect(image).toHaveAttribute("loading", "lazy")
      expect(image).toHaveAttribute("decoding", "async")
      expect(image).toHaveAttribute("width", "1600")
      expect(image).toHaveAttribute("height", "1200")
    }

    expect(within(wall).getByText("可播放动画")).toBeInTheDocument()
    expect(within(wall).getAllByText("可播放动画")).toHaveLength(1)
  })

  it("starts a router view transition from every exhibit cover", async () => {
    const user = userEvent.setup()
    const startViewTransition = vi.fn((update: () => void | Promise<void>) => {
      const updateCallbackDone = Promise.resolve(update())
      return {
        finished: updateCallbackDone,
        ready: Promise.resolve(),
        skipTransition: vi.fn(),
        updateCallbackDone,
      }
    })
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: startViewTransition,
    })

    for (const title of ["滨海湾：与你看夜景", "波奇塔：链锯小恶魔", "翠核标本", "静默观测者", "旷野信使"]) {
      const router = createMemoryRouter(
        [
          { path: "/", element: <CollectionPage /> },
          { path: "/exhibits/:slug/", element: <p>展厅已打开</p> },
        ],
        { initialEntries: ["/"] },
      )
      render(<RouterProvider router={router} />)

      await user.click(screen.getByRole("link", { name: `进入${title}展厅` }))
      expect(await screen.findByText("展厅已打开")).toBeInTheDocument()
      cleanup()
    }

    expect(startViewTransition).toHaveBeenCalledTimes(5)
  })

  it("keeps normal router navigation when view transitions are unavailable", async () => {
    const user = userEvent.setup()
    Object.defineProperty(document, "startViewTransition", {
      configurable: true,
      value: undefined,
    })
    const router = createMemoryRouter(
      [
        { path: "/", element: <CollectionPage /> },
        { path: "/exhibits/:slug/", element: <p>展厅已打开</p> },
      ],
      { initialEntries: ["/"] },
    )
    render(<RouterProvider router={router} />)

    await user.click(screen.getByRole("link", { name: "进入滨海湾：与你看夜景展厅" }))

    expect(await screen.findByText("展厅已打开")).toBeInTheDocument()
  })

  it("preserves the browser's generated shared-element geometry animation", () => {
    render(
      <MemoryRouter>
        <CollectionPage />
      </MemoryRouter>,
    )

    const groupRule = findStyleRule(
      "::view-transition-group(exhibit-cover-pochita)",
    )
    expect(groupRule).toBeDefined()
    expect(groupRule?.style.animationName).toBe("")
    expect(groupRule?.style.animationDuration).toBe("720ms")
    expect(groupRule?.style.animationTimingFunction).toBe(
      "cubic-bezier(0.22, 1, 0.36, 1)",
    )
  })

  it("keeps the site chrome above the fixed collection atmosphere", () => {
    const chromeRule = findStyleRule(
      ".site-frame:has(.collection-page) > :is(.site-header, .site-footer)",
    )

    expect(chromeRule).toBeDefined()
    expect(chromeRule?.style.position).toBe("relative")
    expect(chromeRule?.style.zIndex).toBe("1")
  })
})
