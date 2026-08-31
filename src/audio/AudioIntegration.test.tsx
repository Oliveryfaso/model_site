import { act, cleanup, render, screen, waitFor } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { StrictMode, useEffect } from "react"
import { createMemoryRouter, RouterProvider } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { appRoutes } from "../app/routes"
import type { Exhibit } from "../content/types"

const modelState = vi.hoisted(() => ({
  readyCallbacks: new Map<string, () => void>(),
}))

vi.mock("../exhibit/ModelExperience", () => ({
  ModelExperience: ({ exhibit, onReady }: { exhibit: Exhibit; onReady?: () => void }) => {
    useEffect(() => {
      if (onReady) modelState.readyCallbacks.set(exhibit.slug, onReady)
      return () => {
        modelState.readyCallbacks.delete(exhibit.slug)
      }
    }, [exhibit.slug, onReady])

    return <div>{exhibit.title}三维查看器</div>
  },
}))

type FakeAudio = {
  src: string
  currentTime: number
  loop: boolean
  volume: number
  play: ReturnType<typeof vi.fn>
  pause: ReturnType<typeof vi.fn>
}

const audioState = {
  deferPlay: false,
  rejectPlay: false,
  pendingPlayResolvers: [] as Array<() => void>,
  tracks: [] as FakeAudio[],
}

function installFakeAudio() {
  vi.stubGlobal(
    "Audio",
    vi.fn(function Audio(src: string) {
      const track: FakeAudio = {
        src,
        currentTime: 0,
        loop: false,
        volume: 1,
        play: vi.fn(() =>
          audioState.rejectPlay
            ? Promise.reject(new DOMException("Playback denied", "NotAllowedError"))
            : audioState.deferPlay
            ? new Promise<void>((resolve) => audioState.pendingPlayResolvers.push(resolve))
            : Promise.resolve(),
        ),
        pause: vi.fn(),
      }
      audioState.tracks.push(track)
      return track
    }),
  )
}

function renderGallery(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(<RouterProvider router={router} />)
}

function renderStrictGallery(path: string) {
  const router = createMemoryRouter(appRoutes, { initialEntries: [path] })
  return render(
    <StrictMode>
      <RouterProvider router={router} />
    </StrictMode>,
  )
}

describe("route-aware audio integration", () => {
  beforeEach(() => {
    vi.stubGlobal("localStorage", {
      getItem: vi.fn(() => null),
      setItem: vi.fn(),
      removeItem: vi.fn(),
      clear: vi.fn(),
      key: vi.fn(() => null),
      length: 0,
    })
    audioState.deferPlay = false
    audioState.rejectPlay = false
    audioState.pendingPlayResolvers = []
    audioState.tracks = []
    modelState.readyCallbacks.clear()
    installFakeAudio()
  })

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
    vi.unstubAllGlobals()
  })

  it("stays silent on Fox until opt-in, then activates ambience only after model readiness", async () => {
    const user = userEvent.setup()
    renderGallery("/exhibits/wilderness-messenger/")

    expect(await screen.findByRole("heading", { name: "旷野信使" })).toBeInTheDocument()
    const enableButtons = screen.getAllByRole("button", { name: "开启声音" })
    expect(enableButtons.length).toBeGreaterThanOrEqual(1)
    expect(audioState.tracks).toHaveLength(0)
    expect(localStorage.getItem).toHaveBeenCalledOnce()
    expect(localStorage.getItem).toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
    )

    await user.click(enableButtons[0]!)

    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.src).toBe("/audio/merry-christmas-mr-lawrence.mp3")
    expect(audioState.tracks[0]!.play).toHaveBeenCalledOnce()
    expect(audioState.tracks[0]!.volume).toBeCloseTo(0.16)
    expect(screen.getAllByRole("button", { name: "关闭声音" }).length).toBeGreaterThanOrEqual(1)

    await waitFor(() =>
      expect(modelState.readyCallbacks.has("wilderness-messenger")).toBe(true),
    )
    act(() => modelState.readyCallbacks.get("wilderness-messenger")!())

    await waitFor(() => expect(audioState.tracks).toHaveLength(2))
    expect(audioState.tracks[1]!.src).toBe("/audio/fox-ambient.wav")
    expect(audioState.tracks[1]!.play).toHaveBeenCalledOnce()
  })

  it("restores an exact stored opt-in on a later page lifecycle", async () => {
    vi.mocked(localStorage.getItem).mockReturnValue("true")

    renderGallery("/")

    await waitFor(() => expect(audioState.tracks).toHaveLength(1))
    expect(audioState.tracks[0]!.src).toBe("/audio/merry-christmas-mr-lawrence.mp3")
    expect(audioState.tracks[0]!.play).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "关闭声音" })).toBeInTheDocument()
    expect(localStorage.setItem).not.toHaveBeenCalled()
  })

  it("keeps a stored false preference structurally silent", async () => {
    vi.mocked(localStorage.getItem).mockReturnValue("false")

    renderGallery("/")
    await screen.findByRole("heading", { name: "翠核标本" })

    expect(audioState.tracks).toHaveLength(0)
    expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument()
  })

  it("keeps stored intent and manual controls when autoplay restore is blocked", async () => {
    vi.mocked(localStorage.getItem).mockReturnValue("true")
    audioState.rejectPlay = true
    const user = userEvent.setup()

    renderGallery("/")

    await waitFor(() => expect(audioState.tracks).toHaveLength(1))
    await waitFor(() =>
      expect(screen.getByRole("button", { name: "开启声音" })).toBeInTheDocument(),
    )
    expect(localStorage.setItem).not.toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
      "false",
    )

    audioState.rejectPlay = false
    await user.click(screen.getByRole("button", { name: "开启声音" }))

    expect(screen.getByRole("button", { name: "关闭声音" })).toBeInTheDocument()
    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.play).toHaveBeenCalledTimes(2)
  })

  it("deduplicates Strict Mode restore work while playback is pending", async () => {
    vi.mocked(localStorage.getItem).mockReturnValue("true")
    audioState.deferPlay = true

    renderStrictGallery("/")

    await waitFor(() => expect(audioState.pendingPlayResolvers).toHaveLength(1))
    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.play).toHaveBeenCalledOnce()
    act(() => audioState.pendingPlayResolvers.shift()!())
    await screen.findByRole("button", { name: "关闭声音" })
  })

  it("settles a stored restore in the suspended state while the document is hidden", async () => {
    vi.mocked(localStorage.getItem).mockReturnValue("true")
    vi.spyOn(document, "visibilityState", "get").mockReturnValue("hidden")

    renderGallery("/")

    await screen.findByRole("button", { name: "关闭声音" })
    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.play).toHaveBeenCalledOnce()
    expect(audioState.tracks[0]!.pause).toHaveBeenCalledOnce()
  })

  it("keeps the audio director usable through the Strict Mode effect replay", async () => {
    const user = userEvent.setup()
    renderStrictGallery("/")

    await user.click(await screen.findByRole("button", { name: "开启声音" }))

    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.play).toHaveBeenCalledOnce()
    expect(screen.getByRole("button", { name: "关闭声音" })).toBeInTheDocument()
  })

  it("keeps a no-ambient exhibit on the reduced theme after model readiness", async () => {
    const user = userEvent.setup()
    renderGallery("/exhibits/green-core/")

    await screen.findByRole("heading", { name: "翠核标本" })
    await user.click(screen.getAllByRole("button", { name: "开启声音" })[0]!)
    await waitFor(() => expect(modelState.readyCallbacks.has("green-core")).toBe(true))
    act(() => modelState.readyCallbacks.get("green-core")!())

    expect(audioState.tracks).toHaveLength(1)
    expect(audioState.tracks[0]!.volume).toBeCloseTo(0.16)
    expect(audioState.tracks[0]!.play).toHaveBeenCalled()
  })

  it("disabling from either shared control resets every created track", async () => {
    const user = userEvent.setup()
    renderGallery("/exhibits/wilderness-messenger/")
    await screen.findByRole("heading", { name: "旷野信使" })

    await user.click(screen.getAllByRole("button", { name: "开启声音" })[0]!)
    await waitFor(() => expect(modelState.readyCallbacks.has("wilderness-messenger")).toBe(true))
    act(() => modelState.readyCallbacks.get("wilderness-messenger")!())
    await waitFor(() => expect(audioState.tracks).toHaveLength(2))
    audioState.tracks.forEach((track) => {
      track.currentTime = 3
    })

    await user.click(screen.getAllByRole("button", { name: "关闭声音" })[0]!)

    expect(screen.getAllByRole("button", { name: "开启声音" }).length).toBeGreaterThanOrEqual(1)
    expect(audioState.tracks.every((track) => track.pause.mock.calls.length > 0)).toBe(true)
    expect(audioState.tracks.every((track) => track.currentTime === 0)).toBe(true)
  })

  it("suspends and resumes only while enabled, and removes its visibility listener", async () => {
    let visibilityState: DocumentVisibilityState = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState)
    const user = userEvent.setup()
    const view = renderGallery("/")
    await user.click(await screen.findByRole("button", { name: "开启声音" }))
    const theme = audioState.tracks[0]!

    visibilityState = "hidden"
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(theme.pause).toHaveBeenCalled()
    const playCountBeforeResume = theme.play.mock.calls.length

    visibilityState = "visible"
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    await waitFor(() => expect(theme.play).toHaveBeenCalledTimes(playCountBeforeResume + 1))

    view.unmount()
    const playCountAfterUnmount = theme.play.mock.calls.length
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    expect(theme.play).toHaveBeenCalledTimes(playCountAfterUnmount)
  })

  it("suspends when visibility becomes hidden while opt-in is pending, then resumes", async () => {
    let visibilityState: DocumentVisibilityState = "visible"
    vi.spyOn(document, "visibilityState", "get").mockImplementation(() => visibilityState)
    audioState.deferPlay = true
    const user = userEvent.setup()
    renderGallery("/")

    await user.click(await screen.findByRole("button", { name: "开启声音" }))
    await waitFor(() => expect(audioState.pendingPlayResolvers).toHaveLength(1))
    const theme = audioState.tracks[0]!

    visibilityState = "hidden"
    act(() => document.dispatchEvent(new Event("visibilitychange")))
    act(() => audioState.pendingPlayResolvers.shift()!())

    await screen.findByRole("button", { name: "关闭声音" })
    expect(theme.pause).toHaveBeenCalledOnce()
    const playsBeforeResume = theme.play.mock.calls.length

    audioState.deferPlay = false
    visibilityState = "visible"
    act(() => document.dispatchEvent(new Event("visibilitychange")))

    await waitFor(() => expect(theme.play).toHaveBeenCalledTimes(playsBeforeResume + 1))
  })
})
