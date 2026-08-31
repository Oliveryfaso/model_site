import { afterEach, beforeEach, describe, expect, it, vi, type Mock } from "vitest"
import { AudioDirector, type AudioTrack } from "./AudioDirector"

type FakeTrack = AudioTrack & {
  src: string
  play: Mock<() => Promise<void>>
  pause: Mock<() => void>
}

type HarnessOptions = {
  rejectedSources?: string[]
  storedPreference?: string | null
  playPromise?: Promise<void>
  storageGetError?: Error
  storageSetError?: Error
}

function createHarness(input: string[] | HarnessOptions = {}) {
  const options: HarnessOptions = Array.isArray(input) ? { rejectedSources: input } : input
  const rejectedSources = new Set(options.rejectedSources ?? [])
  const tracks: FakeTrack[] = []
  const createTrack = vi.fn((src: string): FakeTrack => {
    const track: FakeTrack = {
      src,
      currentTime: 4,
      loop: false,
      volume: 1,
      play: vi.fn(() =>
        options.playPromise
          ? options.playPromise
          : rejectedSources.has(src)
          ? Promise.reject(new DOMException("Playback denied", "NotAllowedError"))
          : Promise.resolve(),
      ),
      pause: vi.fn(),
    }
    tracks.push(track)
    return track
  })
  const storage = {
    getItem: vi.fn(() => {
      if (options.storageGetError) throw options.storageGetError
      return options.storedPreference ?? null
    }),
    setItem: vi.fn(() => {
      if (options.storageSetError) throw options.storageSetError
    }),
  }
  const director = new AudioDirector({
    createTrack,
    durationMs: 1_000,
    storage,
    themeSrc: "/audio/merry-christmas-mr-lawrence.mp3",
  })

  return { createTrack, director, rejectedSources, storage, tracks }
}

async function flushPromises() {
  await Promise.resolve()
  await Promise.resolve()
}

describe("AudioDirector", () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it("keeps first load silent and creates the theme only after opt-in", async () => {
    const { createTrack, director, storage, tracks } = createHarness()

    director.enterCollection()

    expect(createTrack).not.toHaveBeenCalled()
    expect(storage.getItem).toHaveBeenCalledOnce()
    expect(storage.getItem).toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
    )
    expect(storage.setItem).not.toHaveBeenCalled()

    await expect(director.enable()).resolves.toBe(true)

    expect(createTrack).toHaveBeenCalledOnce()
    expect(tracks[0]!.play).toHaveBeenCalledOnce()
    expect(tracks[0]!.loop).toBe(true)
    expect(tracks[0]!.volume).toBeCloseTo(0.3)
    expect(storage.setItem).toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
      "true",
    )
  })

  it.each([null, "false", "TRUE", "1"])(
    "does not restore unless the stored preference is exact true (%s)",
    async (storedPreference) => {
      const { createTrack, director } = createHarness({ storedPreference })
      director.enterCollection()

      await expect(director.restoreStoredPreference()).resolves.toBe(false)

      expect(createTrack).not.toHaveBeenCalled()
      expect(director.isEnabled()).toBe(false)
    },
  )

  it("restores stored opt-in against the current route without rewriting intent", async () => {
    const { director, storage, tracks } = createHarness({ storedPreference: "true" })
    director.enterExhibit(undefined)

    await expect(director.restoreStoredPreference()).resolves.toBe(true)

    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.src).toBe("/audio/merry-christmas-mr-lawrence.mp3")
    expect(tracks[0]!.volume).toBeCloseTo(0.16)
    expect(tracks[0]!.play).toHaveBeenCalledOnce()
    expect(director.isEnabled()).toBe(true)
    expect(storage.setItem).not.toHaveBeenCalled()
  })

  it("deduplicates concurrent stored-preference restore attempts", async () => {
    let resolvePlay!: () => void
    const playPromise = new Promise<void>((resolve) => {
      resolvePlay = resolve
    })
    const { createTrack, director, tracks } = createHarness({
      playPromise,
      storedPreference: "true",
    })
    director.enterCollection()

    const firstRestore = director.restoreStoredPreference()
    const concurrentRestore = director.restoreStoredPreference()

    expect(createTrack).toHaveBeenCalledOnce()
    expect(tracks[0]!.play).toHaveBeenCalledOnce()
    resolvePlay()
    await expect(Promise.all([firstRestore, concurrentRestore])).resolves.toEqual([
      true,
      true,
    ])
  })

  it("keeps stored intent when autoplay restore is rejected and allows manual retry", async () => {
    const { director, rejectedSources, storage, tracks } = createHarness({
      rejectedSources: ["/audio/merry-christmas-mr-lawrence.mp3"],
      storedPreference: "true",
    })
    director.enterCollection()

    await expect(director.restoreStoredPreference()).resolves.toBe(false)

    expect(director.isEnabled()).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
      "false",
    )
    rejectedSources.clear()

    await expect(director.enable()).resolves.toBe(true)
    expect(director.isEnabled()).toBe(true)
    expect(tracks).toHaveLength(1)
    expect(tracks[0]!.play).toHaveBeenCalledTimes(2)
  })

  it("treats unavailable preference storage as non-fatal", async () => {
    expect(() =>
      createHarness({ storageGetError: new DOMException("Denied", "SecurityError") }),
    ).not.toThrow()
    const { director } = createHarness({
      storageSetError: new DOMException("Quota exceeded", "QuotaExceededError"),
    })
    director.enterCollection()

    await expect(director.enable()).resolves.toBe(true)
    expect(director.isEnabled()).toBe(true)
    expect(() => director.disable()).not.toThrow()
    expect(director.isEnabled()).toBe(false)
  })

  it("crossfades from the collection theme to ambience and back to the reduced theme", async () => {
    const { director, tracks } = createHarness()
    director.enterCollection()
    await director.enable()
    const theme = tracks[0]!

    director.enterExhibit("/audio/fox-ambient.wav")
    await flushPromises()
    const ambient = tracks[1]!
    vi.advanceTimersByTime(1_000)

    expect(theme.volume).toBeCloseTo(0.12)
    expect(theme.pause).not.toHaveBeenCalled()
    expect(ambient.volume).toBeCloseTo(0.45)

    director.enterExhibit(undefined)
    await flushPromises()
    vi.advanceTimersByTime(1_000)

    expect(theme.volume).toBeCloseTo(0.16)
    expect(ambient.volume).toBe(0)
    expect(ambient.pause).toHaveBeenCalledOnce()
    expect(ambient.currentTime).toBe(0)
  })

  it("cancels an earlier fade so a stale transition cannot win a route race", async () => {
    const { director, tracks } = createHarness()
    director.enterCollection()
    await director.enable()
    director.enterExhibit("/audio/fox-ambient.wav")
    await flushPromises()
    vi.advanceTimersByTime(400)

    director.enterCollection()
    await flushPromises()
    vi.advanceTimersByTime(2_000)

    expect(tracks[0]!.volume).toBeCloseTo(0.3)
    expect(tracks[0]!.pause).not.toHaveBeenCalled()
    expect(tracks[1]!.volume).toBe(0)
    expect(tracks[1]!.pause).toHaveBeenCalledOnce()
  })

  it("never retains more than one ambient instance when routes switch quickly", async () => {
    const { director, tracks } = createHarness()
    director.enterCollection()
    await director.enable()

    director.enterExhibit("/audio/a.wav")
    await flushPromises()
    const firstAmbient = tracks[1]!
    director.enterExhibit("/audio/b.wav")
    await flushPromises()

    expect(firstAmbient.pause).toHaveBeenCalledOnce()
    expect(firstAmbient.currentTime).toBe(0)
    expect(tracks).toHaveLength(3)
    vi.advanceTimersByTime(1_000)
    expect(tracks[2]!.volume).toBeCloseTo(0.45)
  })

  it("does not persist opt-in when initial playback is rejected", async () => {
    const { director, storage, tracks } = createHarness(["/audio/merry-christmas-mr-lawrence.mp3"])
    director.enterCollection()

    await expect(director.enable()).resolves.toBe(false)

    expect(director.isEnabled()).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
      "true",
    )
    expect(tracks[0]!.pause).toHaveBeenCalledOnce()
    expect(tracks[0]!.currentTime).toBe(0)
  })

  it("disables playback without erasing stored intent when later ambience is rejected", async () => {
    const { director, storage, tracks } = createHarness(["/audio/fox-ambient.wav"])
    director.enterCollection()
    await director.enable()

    director.enterExhibit("/audio/fox-ambient.wav")
    await flushPromises()

    expect(director.isEnabled()).toBe(false)
    expect(storage.setItem).not.toHaveBeenCalledWith(
      "digital-figure-gallery:sound-enabled",
      "false",
    )
    expect(tracks.every((track) => track.currentTime === 0)).toBe(true)
  })

  it("disable pauses and resets every track without allowing fade timers to revive them", async () => {
    const { director, storage, tracks } = createHarness()
    director.enterCollection()
    await director.enable()
    director.enterExhibit("/audio/fox-ambient.wav")
    await flushPromises()
    vi.advanceTimersByTime(300)

    director.disable()
    const volumesAfterDisable = tracks.map((track) => track.volume)
    vi.advanceTimersByTime(2_000)

    expect(director.isEnabled()).toBe(false)
    expect(tracks.every((track) => track.currentTime === 0)).toBe(true)
    expect(tracks.every((track) => track.pause.mock.calls.length > 0)).toBe(true)
    expect(tracks.map((track) => track.volume)).toEqual(volumesAfterDisable)
    expect(storage.setItem).toHaveBeenLastCalledWith(
      "digital-figure-gallery:sound-enabled",
      "false",
    )
  })

  it("suspends without losing opt-in and resumes the current desired route", async () => {
    const { director, tracks } = createHarness()
    director.enterCollection()
    await director.enable()
    const theme = tracks[0]!

    director.suspend()
    const playsBeforeRouteChange = theme.play.mock.calls.length
    director.enterExhibit(undefined)
    await flushPromises()
    expect(theme.play).toHaveBeenCalledTimes(playsBeforeRouteChange)
    expect(director.isEnabled()).toBe(true)

    director.resume()
    await flushPromises()
    vi.advanceTimersByTime(1_000)

    expect(theme.play).toHaveBeenCalledTimes(playsBeforeRouteChange + 1)
    expect(theme.volume).toBeCloseTo(0.16)
  })
})
