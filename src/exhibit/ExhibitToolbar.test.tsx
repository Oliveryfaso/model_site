import { act, cleanup, fireEvent, render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { createRef } from "react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { AudioProvider } from "../audio/AudioProvider"
import type { Exhibit } from "../content/types"
import type { ShareEnvironment } from "../sharing/shareExhibit"
import { ExhibitToolbar } from "./ExhibitToolbar"

const exhibit: Exhibit = {
  slug: "green-core",
  collectionNumber: "001",
  title: "翠核标本",
  summary: "一枚被当作未知生命核心保存的绿色标本。",
  description: "完整介绍。",
  tags: ["有机"],
  cover: "/covers/avocado.jpg",
  model: "/models/avocado.glb",
  presentation: {
    layout: "center-stage",
    scene: "warm-cabinet",
    palette: ["#263d1f", "#92b85c", "#b47b3e"],
    lightingPresets: ["warm"],
  },
}

const nextExhibit: Exhibit = {
  ...exhibit,
  slug: "silent-observer",
  title: "静默观测者",
  model: "/models/antique-camera.glb",
}

function deferred() {
  let resolve!: () => void
  const promise = new Promise<void>((next) => {
    resolve = next
  })
  return { promise, resolve }
}

function toolbar(exhibitValue: Exhibit, environment: ShareEnvironment) {
  return (
    <MemoryRouter>
      <AudioProvider>
        <ExhibitToolbar
          controlsRef={createRef()}
          exhibit={exhibitValue}
          lightingPreset="warm"
          lightingOptions={["warm"]}
          onLightingChange={() => undefined}
          shareEnvironment={environment}
          viewerRef={createRef()}
        />
      </AudioProvider>
    </MemoryRouter>
  )
}

describe("ExhibitToolbar sharing", () => {
  afterEach(() => {
    cleanup()
    vi.useRealTimers()
  })

  it("announces clipboard success for two seconds", async () => {
    vi.useFakeTimers()
    const env: ShareEnvironment = {
      origin: "https://gallery.example",
      canNativeShare: false,
      share: vi.fn().mockResolvedValue(undefined),
      writeText: vi.fn().mockResolvedValue(undefined),
    }
    render(toolbar(exhibit, env))

    fireEvent.click(screen.getByRole("button", { name: "分享藏品" }))
    await act(async () => {
      await Promise.resolve()
    })

    expect(screen.getByText("链接已复制")).toHaveAttribute("aria-live", "polite")
    expect(env.writeText).toHaveBeenCalledWith(
      "https://gallery.example/exhibits/green-core/",
    )

    act(() => {
      vi.advanceTimersByTime(1_999)
    })
    expect(screen.getByText("链接已复制")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1)
    })
    expect(screen.queryByText("链接已复制")).not.toBeInTheDocument()
  })

  it("ignores a share completion from the previous exhibit identity", async () => {
    vi.useFakeTimers()
    const pendingWrite = deferred()
    const env: ShareEnvironment = {
      origin: "https://gallery.example",
      canNativeShare: false,
      share: async () => undefined,
      writeText: () => pendingWrite.promise,
    }
    const rendered = render(toolbar(exhibit, env))

    fireEvent.click(screen.getByRole("button", { name: "分享藏品" }))
    rendered.rerender(toolbar(nextExhibit, env))
    const timersAfterIdentityChange = vi.getTimerCount()
    await act(async () => pendingWrite.resolve())

    expect(screen.queryByText("链接已复制")).not.toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(timersAfterIdentityChange)
  })

  it("does not update state or create a timer after unmount", async () => {
    vi.useFakeTimers()
    const pendingWrite = deferred()
    const env: ShareEnvironment = {
      origin: "https://gallery.example",
      canNativeShare: false,
      share: async () => undefined,
      writeText: () => pendingWrite.promise,
    }
    const rendered = render(toolbar(exhibit, env))

    fireEvent.click(screen.getByRole("button", { name: "分享藏品" }))
    rendered.unmount()
    const timersAfterUnmount = vi.getTimerCount()
    await act(async () => pendingWrite.resolve())

    expect(vi.getTimerCount()).toBe(timersAfterUnmount)
  })

  it("lets only the latest rapid request control copied feedback", async () => {
    vi.useFakeTimers()
    const firstWrite = deferred()
    const secondWrite = deferred()
    let writeNumber = 0
    const env: ShareEnvironment = {
      origin: "https://gallery.example",
      canNativeShare: false,
      share: async () => undefined,
      writeText: () => {
        writeNumber += 1
        return writeNumber === 1 ? firstWrite.promise : secondWrite.promise
      },
    }
    render(toolbar(exhibit, env))

    const shareButton = screen.getByRole("button", { name: "分享藏品" })
    fireEvent.click(shareButton)
    fireEvent.click(shareButton)
    await act(async () => secondWrite.resolve())
    expect(screen.getByText("链接已复制")).toBeInTheDocument()

    act(() => {
      vi.advanceTimersByTime(1_000)
    })
    await act(async () => firstWrite.resolve())
    act(() => {
      vi.advanceTimersByTime(1_000)
    })

    expect(screen.queryByText("链接已复制")).not.toBeInTheDocument()
    expect(vi.getTimerCount()).toBe(0)
  })

  it("keeps focus on the native details summary when mobile lighting controls close", async () => {
    const user = userEvent.setup()
    const env: ShareEnvironment = {
      origin: "https://gallery.example",
      canNativeShare: false,
      share: async () => undefined,
      writeText: async () => undefined,
    }
    render(toolbar(exhibit, env))
    const summary = screen.getByText("灯光设置")
    const details = summary.closest("details")!
    expect(details).toHaveAttribute("open")

    await user.click(summary)

    expect(details).not.toHaveAttribute("open")
    expect(summary).toHaveFocus()
  })
})
