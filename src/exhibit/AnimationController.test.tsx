import { act, cleanup, render, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AnimationClip, LoopRepeat, Object3D } from "three"
import type { AnimationControlsState } from "./AnimationController"

const animationHarness = vi.hoisted(() => ({
  api: undefined as unknown,
}))

vi.mock("@react-three/drei", () => ({
  useAnimations: () => animationHarness.api,
}))

import { AnimationController } from "./AnimationController"

function makeHarness(clipName = "Survey") {
  const action = {
    enabled: false,
    paused: false,
    play: vi.fn(),
    reset: vi.fn(),
    setLoop: vi.fn(),
    stop: vi.fn(),
  }
  action.play.mockReturnValue(action)
  action.reset.mockReturnValue(action)
  action.setLoop.mockReturnValue(action)
  action.stop.mockReturnValue(action)
  const mixer = {
    stopAllAction: vi.fn(),
    uncacheAction: vi.fn(),
    uncacheClip: vi.fn(),
    uncacheRoot: vi.fn(),
  }
  const clip = new AnimationClip(clipName, 1, [])
  animationHarness.api = {
    actions: { [clipName]: action },
    clips: [clip],
    mixer,
    names: [clipName],
    ref: { current: null },
  }
  return { action, clip, mixer }
}

describe("AnimationController", () => {
  beforeEach(() => makeHarness())

  afterEach(() => {
    cleanup()
    vi.restoreAllMocks()
  })

  it("starts manual animation paused at time zero and preserves progress across pause/resume", async () => {
    const { action } = makeHarness()
    const states: AnimationControlsState[] = []
    render(
      <AnimationController
        animations={(animationHarness.api as { clips: AnimationClip[] }).clips}
        scene={new Object3D()}
        animation={{ mode: "manual", clip: "Survey" }}
        onChange={(state) => states.push(state)}
      />,
    )

    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: false }))
    expect(action.paused).toBe(true)
    expect(action.play).not.toHaveBeenCalled()
    act(() => states.at(-1)!.toggle())
    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: true }))
    expect(action.setLoop).toHaveBeenCalledWith(LoopRepeat, Infinity)
    expect(action.play).toHaveBeenCalledOnce()

    ;(action as typeof action & { time: number }).time = 0.42
    act(() => states.at(-1)!.toggle())
    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: false }))
    expect(action.paused).toBe(true)
    expect((action as typeof action & { time: number }).time).toBe(0.42)
    expect(action.stop).not.toHaveBeenCalled()

    act(() => states.at(-1)!.toggle())
    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: true }))
    expect(action.paused).toBe(false)
    expect((action as typeof action & { time: number }).time).toBe(0.42)
    expect(action.reset).toHaveBeenCalledOnce()
  })

  it("autoplays the selected clip on a repeating loop", async () => {
    const { action } = makeHarness("Walk")
    const states: AnimationControlsState[] = []
    render(
      <AnimationController
        animations={(animationHarness.api as { clips: AnimationClip[] }).clips}
        scene={new Object3D()}
        animation={{ mode: "autoplay", clip: "Walk" }}
        onChange={(state) => states.push(state)}
      />,
    )

    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: true }))
    expect(action.setLoop).toHaveBeenCalledWith(LoopRepeat, Infinity)
    expect(action.play).toHaveBeenCalledOnce()

    ;(action as typeof action & { time: number }).time = 0.68
    act(() => states.at(-1)!.toggle())
    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: false }))
    expect(action.paused).toBe(true)
    expect((action as typeof action & { time: number }).time).toBe(0.68)

    act(() => states.at(-1)!.toggle())
    await waitFor(() => expect(states.at(-1)).toMatchObject({ available: true, playing: true }))
    expect(action.paused).toBe(false)
    expect((action as typeof action & { time: number }).time).toBe(0.68)
    expect(action.reset).toHaveBeenCalledOnce()
  })

  it("hides a missing configured clip and warns once in development", async () => {
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined)
    const clips = (animationHarness.api as { clips: AnimationClip[] }).clips
    const scene = new Object3D()
    const states: AnimationControlsState[] = []
    const first = render(
      <AnimationController
        animations={clips}
        scene={scene}
        animation={{ mode: "manual", clip: "Absent-task-eight-clip" }}
        onChange={(state) => states.push(state)}
      />,
    )

    await waitFor(() => expect(states.at(-1)?.available).toBe(false))
    first.unmount()
    render(
      <AnimationController
        animations={clips}
        scene={new Object3D()}
        animation={{ mode: "manual", clip: "Absent-task-eight-clip" }}
      />,
    )

    expect(warn).toHaveBeenCalledOnce()
  })

  it("stops actions and uncaches actions, clips, and the owned root on cleanup", () => {
    const { action, clip, mixer } = makeHarness()
    const scene = new Object3D()
    const view = render(
      <AnimationController
        animations={[clip]}
        scene={scene}
        animation={{ mode: "manual", clip: "Survey" }}
      />,
    )

    view.unmount()

    expect(action.stop).toHaveBeenCalled()
    expect(mixer.stopAllAction).toHaveBeenCalled()
    expect(mixer.uncacheAction).toHaveBeenCalledWith(clip, scene)
    expect(mixer.uncacheClip).toHaveBeenCalledWith(clip)
    expect(mixer.uncacheRoot).toHaveBeenCalledWith(scene)
  })
})
