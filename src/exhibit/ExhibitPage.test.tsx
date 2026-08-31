import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { useEffect, useImperativeHandle } from "react"
import { createMemoryRouter, MemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { appRoutes } from "../app/routes"
import { exhibits } from "../content/exhibits"
import type { Exhibit } from "../content/types"
import { CollectionPage } from "../home/CollectionPage"
import type { AnimationControlsState } from "./AnimationController"
import type { ModelControlsHandle } from "./ModelScene"

const viewerState = vi.hoisted(() => ({
  animationCallbacks: [] as Array<{
    identity: string
    callback(state: AnimationControlsState): void
  }>,
  autoNotify: true,
  resetCamera: vi.fn(),
}))

vi.mock("./ModelExperience", () => ({
  ModelExperience: ({
    exhibit,
    controlsRef,
    onAnimationControlsChange,
    captureFrameScale,
  }: {
    exhibit: Exhibit
    controlsRef?: React.Ref<ModelControlsHandle>
    onAnimationControlsChange?(state: AnimationControlsState): void
    captureFrameScale?: number
  }) => {
    useImperativeHandle(controlsRef, () => ({ resetCamera: viewerState.resetCamera }))
    useEffect(() => {
      if (exhibit.animation?.mode !== "manual") return
      if (!onAnimationControlsChange) return
      viewerState.animationCallbacks.push({
        identity: `${exhibit.slug}:${exhibit.model}`,
        callback: onAnimationControlsChange,
      })
      if (viewerState.autoNotify) {
        onAnimationControlsChange({
          available: true,
          playing: false,
          toggle: vi.fn(),
        })
      }
    }, [exhibit, onAnimationControlsChange])

    const camera = exhibit.presentation.camera
    const cameraDistance = camera
      ? Math.hypot(
          camera.position[0] - camera.target[0],
          camera.position[1] - camera.target[1],
          camera.position[2] - camera.target[2],
        )
      : undefined

    return (
      <figure
        data-camera-distance={cameraDistance}
        className="model-experience"
        data-camera-target-y={exhibit.presentation.camera?.target[1]}
        data-capture-frame-scale={captureFrameScale}
        data-model-state="ready"
        data-testid="mock-model"
      >
        <img
          className="model-experience__cover"
          data-cover-hidden="true"
          src={exhibit.cover}
          alt={`${exhibit.title}封面`}
          style={{ display: "block", pointerEvents: "auto", visibility: "visible" }}
        />
        <div className="model-experience__canvas" data-testid="mock-canvas-layer">
          <div data-testid="mock-r3f-host">
            <canvas data-testid="mock-webgl-canvas" />
          </div>
        </div>
        <figcaption>{exhibit.title}三维查看器</figcaption>
      </figure>
    )
  },
}))

function useCompactViewport() {
  vi.stubGlobal(
    "matchMedia",
    vi.fn().mockReturnValue({
      matches: true,
      media: "(max-width: 48rem)",
      onchange: null,
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      addListener: vi.fn(),
      removeListener: vi.fn(),
      dispatchEvent: vi.fn(),
    }),
  )
}

function renderExhibit(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return {
    router,
    ...render(<RouterProvider router={router} />),
  }
}

describe("ExhibitPage", () => {
  afterEach(() => {
    cleanup()
    viewerState.animationCallbacks = []
    viewerState.autoNotify = true
    viewerState.resetCamera.mockReset()
    vi.unstubAllGlobals()
    vi.restoreAllMocks()
  })

  it("uses a borderless shell without global chrome on exhibit routes", async () => {
    const { container } = renderExhibit("/exhibits/green-core/")

    await screen.findByRole("heading", { level: 1, name: "翠核标本" })
    expect(container.querySelector(".site-frame")).toHaveClass("site-frame--exhibit")
    expect(screen.queryByRole("banner")).not.toBeInTheDocument()
    expect(screen.queryByRole("contentinfo")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: "返回馆藏" })).toBeVisible()
    expect(screen.getByRole("button", { name: "分享藏品" })).toBeVisible()
    expect(screen.getByRole("button", { name: "开启声音" })).toBeVisible()
    expect(screen.getByRole("button", { name: "重置镜头" })).toBeVisible()
  })

  it("matches each home cover to a slug-derived detail target when scenes are reused", async () => {
    render(
      <MemoryRouter>
        <CollectionPage />
      </MemoryRouter>,
    )
    const homeNames = new Map(
      exhibits.map((exhibit) => [
        exhibit.slug,
        screen.getByRole("img", { name: exhibit.title }).style.viewTransitionName,
      ]),
    )
    cleanup()

    const originalScenes = exhibits.map((exhibit) => exhibit.presentation.scene)
    try {
      for (const exhibit of exhibits) exhibit.presentation.scene = "warm-cabinet"

      for (const exhibit of exhibits) {
        const { container } = renderExhibit(`/exhibits/${exhibit.slug}/`)
        await screen.findByRole("heading", { level: 1, name: exhibit.title })
        const detailName = (
          container.querySelector(".exhibit-viewer") as HTMLElement
        ).style.viewTransitionName
        expect(homeNames.get(exhibit.slug)).toBe(`exhibit-cover-${exhibit.slug}`)
        expect(detailName).toBe(homeNames.get(exhibit.slug))
        cleanup()
      }
    } finally {
      exhibits.forEach((exhibit, index) => {
        exhibit.presentation.scene = originalScenes[index]!
      })
    }
  })

  it("opens an accessible compact information disclosure without hiding the title", async () => {
    useCompactViewport()
    const user = userEvent.setup()
    renderExhibit("/exhibits/green-core/")

    expect(
      await screen.findByRole("heading", { level: 1, name: "翠核标本" }),
    ).toBeVisible()
    const disclosure = screen.getByRole("button", { name: "查看藏品说明" })
    expect(disclosure).toHaveAttribute("aria-expanded", "false")
    expect(
      screen.getByText(/它没有角色履历，却像某种沉睡生命留下的核心/).parentElement,
    ).toHaveAttribute("aria-hidden", "true")

    await user.click(disclosure)

    expect(disclosure).toHaveAttribute("aria-expanded", "true")
    expect(
      screen.getByText(/它没有角色履历，却像某种沉睡生命留下的核心/).parentElement,
    ).toHaveAttribute("aria-hidden", "false")
  })

  it("keeps every compact exhibit control at least 44px tall", async () => {
    useCompactViewport()
    renderExhibit("/exhibits/green-core/")

    await screen.findByRole("heading", { level: 1, name: "翠核标本" })
    const toolbar = screen.getByRole("navigation", { name: "三维查看器工具" })
    const controls = [
      screen.getByRole("link", { name: "返回馆藏" }),
      screen.getByRole("button", { name: "查看藏品说明" }),
      ...toolbar.querySelectorAll<HTMLElement>("button, summary"),
    ]

    controls.forEach((control) => {
      expect(getComputedStyle(control).minHeight).toBe("44px")
    })
  })

  it("renders only the screenshot stage in cover capture mode", async () => {
    const { container } = renderExhibit("/exhibits/green-core/?capture=cover")

    const capture = await waitFor(() => container.querySelector("[data-cover-capture]"))
    expect(capture).toContainElement(screen.getByTestId("mock-model"))
    expect(screen.queryByRole("heading", { level: 1 })).not.toBeInTheDocument()
    expect(screen.queryByRole("link", { name: "返回馆藏" })).not.toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "分享藏品" })).not.toBeInTheDocument()
  })

  it("fills the cover capture stage with the WebGL layer", async () => {
    renderExhibit("/exhibits/green-core/?capture=cover")

    const canvasLayer = await screen.findByTestId("mock-canvas-layer")
    const r3fHost = screen.getByTestId("mock-r3f-host")
    const canvas = screen.getByTestId("mock-webgl-canvas")

    expect(getComputedStyle(canvasLayer).height).toBe("100%")
    expect(getComputedStyle(canvasLayer).position).toBe("absolute")
    expect(getComputedStyle(canvasLayer).zIndex).toBe("1")
    expect(getComputedStyle(r3fHost).height).toBe("100%")
    expect(getComputedStyle(canvas).height).toBe("100%")
  })

  it.each([
    ["green-core", -0.05, 5.676424931239732],
    ["silent-observer", 0.1, 6.852164347853895],
    ["wilderness-messenger", 0.45, 7.867153233540071],
  ] as const)("applies the shared safe frame to the %s cover", async (slug, targetY, distance) => {
    renderExhibit(`/exhibits/${slug}/?capture=cover`)

    const model = await screen.findByTestId("mock-model")
    expect(Number(model.dataset.cameraTargetY)).toBeCloseTo(targetY)
    expect(Number(model.dataset.cameraDistance)).toBeCloseTo(distance)
    expect(Number(model.dataset.captureFrameScale)).toBe(0.78)
  })

  it("removes a ready cover from interaction and paint", async () => {
    renderExhibit("/exhibits/green-core/")

    const cover = await screen.findByAltText("翠核标本封面")
    const style = getComputedStyle(cover)
    expect(style.display).toBe("none")
    expect(style.visibility).toBe("hidden")
    expect(style.pointerEvents).toBe("none")
  })

  it("shows the configured manual animation and lighting controls", async () => {
    renderExhibit("/exhibits/wilderness-messenger/")

    expect(
      await screen.findByRole("heading", { level: 1, name: "旷野信使" }),
    ).toBeInTheDocument()
    expect(await screen.findByRole("button", { name: "播放动画" })).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "切换到月光灯光" })).toBeInTheDocument()
  })

  it("does not expose animation controls for a static exhibit", async () => {
    renderExhibit("/exhibits/green-core/")

    expect(
      await screen.findByRole("heading", { level: 1, name: "翠核标本" }),
    ).toBeInTheDocument()
    expect(screen.queryByRole("button", { name: "播放动画" })).not.toBeInTheDocument()
  })

  it("keeps one primary heading, full visible copy, and sharing outside the viewer", async () => {
    renderExhibit("/exhibits/green-core/")

    expect(await screen.findAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByText("一枚被当作未知生命核心保存的绿色标本。")).toBeVisible()
    expect(
      screen.getByText(/它没有角色履历，却像某种沉睡生命留下的核心/),
    ).toBeVisible()
    expect(screen.getByRole("button", { name: "分享藏品" })).toBeVisible()
  })

  it.each([
    ["/exhibits/green-core/", "center-stage"],
    ["/exhibits/silent-observer/", "story-offset"],
    ["/exhibits/wilderness-messenger/", "immersive"],
  ] as const)("renders %s with the %s composition", async (path, layout) => {
    renderExhibit(path)

    const heading = await screen.findByRole("heading", { level: 1 })
    expect(heading.closest("[data-layout]")).toHaveAttribute("data-layout", layout)
  })

  it("resets lighting to the next exhibit's first configured preset", async () => {
    const user = userEvent.setup()
    const { router } = renderExhibit("/exhibits/wilderness-messenger/")

    await user.click(await screen.findByRole("button", { name: "切换到星光灯光" }))
    expect(screen.getByRole("button", { name: "切换到星光灯光" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await router.navigate("/exhibits/silent-observer/")

    expect(await screen.findByRole("button", { name: "切换到顶光灯光" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.queryByRole("button", { name: "切换到月光灯光" })).not.toBeInTheDocument()
  })

  it("resets lighting on an A to B to A route round trip", async () => {
    const user = userEvent.setup()
    const { router } = renderExhibit("/exhibits/wilderness-messenger/")

    await user.click(await screen.findByRole("button", { name: "切换到星光灯光" }))
    expect(screen.getByRole("button", { name: "切换到星光灯光" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )

    await router.navigate("/exhibits/silent-observer/")
    await screen.findByRole("heading", { level: 1, name: "静默观测者" })
    await router.navigate("/exhibits/wilderness-messenger/")

    expect(await screen.findByRole("button", { name: "切换到月光灯光" })).toHaveAttribute(
      "aria-pressed",
      "true",
    )
    expect(screen.getByRole("button", { name: "切换到星光灯光" })).toHaveAttribute(
      "aria-pressed",
      "false",
    )
  })

  it("rejects animation controls from an earlier A visit after A to B to A", async () => {
    viewerState.autoNotify = false
    const { router } = renderExhibit("/exhibits/wilderness-messenger/")
    await screen.findByRole("heading", { level: 1, name: "旷野信使" })
    await waitFor(() => expect(viewerState.animationCallbacks).toHaveLength(1))
    const staleVisit = viewerState.animationCallbacks[0]!

    act(() => {
      staleVisit.callback({ available: true, playing: false, toggle: vi.fn() })
    })
    expect(screen.getByRole("button", { name: "播放动画" })).toBeInTheDocument()

    await router.navigate("/exhibits/silent-observer/")
    await screen.findByRole("heading", { level: 1, name: "静默观测者" })
    await router.navigate("/exhibits/wilderness-messenger/")
    await waitFor(() => expect(viewerState.animationCallbacks).toHaveLength(2))
    const currentVisit = viewerState.animationCallbacks[1]!

    expect(screen.queryByRole("button", { name: "播放动画" })).not.toBeInTheDocument()
    act(() => {
      staleVisit.callback({ available: true, playing: true, toggle: vi.fn() })
    })
    expect(screen.queryByRole("button", { name: "暂停动画" })).not.toBeInTheDocument()

    act(() => {
      currentVisit.callback({ available: true, playing: false, toggle: vi.fn() })
    })
    expect(screen.getByRole("button", { name: "播放动画" })).toBeInTheDocument()
  })

  it("connects reset and safely handles a rejected fullscreen request", async () => {
    const user = userEvent.setup()
    const rejectedFullscreen = vi
      .fn()
      .mockRejectedValue(new DOMException("Fullscreen denied", "NotAllowedError"))
    Object.defineProperty(HTMLElement.prototype, "requestFullscreen", {
      configurable: true,
      value: rejectedFullscreen,
    })
    vi.spyOn(console, "warn").mockImplementation(() => undefined)
    renderExhibit("/exhibits/green-core/")

    await user.click(await screen.findByRole("button", { name: "重置镜头" }))
    await user.click(screen.getByRole("button", { name: "全屏查看" }))

    expect(viewerState.resetCamera).toHaveBeenCalledOnce()
    expect(rejectedFullscreen).toHaveBeenCalledOnce()
    await waitFor(() => expect(console.warn).toHaveBeenCalledOnce())
  })
})
