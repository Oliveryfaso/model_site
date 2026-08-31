import { useAnimations } from "@react-three/drei"
import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { LoopRepeat, type AnimationClip, type Object3D } from "three"
import type { Exhibit } from "../content/types"

export type AnimationControlsState = {
  available: boolean
  playing: boolean
  toggle(): void
}

type AnimationControllerProps = {
  animations: AnimationClip[]
  scene: Object3D
  animation?: Exhibit["animation"]
  onChange?(state: AnimationControlsState): void
}

const warnedMissingClips = new Set<string>()

export function AnimationController({
  animations,
  scene,
  animation,
  onChange,
}: AnimationControllerProps) {
  const mode = animation?.mode ?? "static"
  const { actions, mixer } = useAnimations(animations, scene)
  const selectedClip = useMemo(() => {
    if (mode === "static") return undefined
    if (!animation?.clip) return animations[0]
    return animations.find((clip) => clip.name === animation.clip)
  }, [animation?.clip, animations, mode])
  const action = selectedClip ? actions[selectedClip.name] : undefined
  const available = mode !== "static" && Boolean(selectedClip && action)
  const [playing, setPlaying] = useState(false)
  const startedAction = useRef<typeof action>(undefined)

  useEffect(() => {
    const missingClip = animation?.clip
    if (
      !import.meta.env.DEV ||
      mode === "static" ||
      !missingClip ||
      selectedClip ||
      warnedMissingClips.has(missingClip)
    ) {
      return
    }

    warnedMissingClips.add(missingClip)
    console.warn(`未找到配置的动画片段：${missingClip}`)
  }, [animation?.clip, mode, selectedClip])

  useEffect(() => {
    mixer.stopAllAction()
    startedAction.current = undefined
    setPlaying(false)
    if (!action || !selectedClip || mode === "static") return

    action.reset().setLoop(LoopRepeat, Infinity)
    action.enabled = true
    if (mode === "autoplay") {
      action.paused = false
      action.play()
      startedAction.current = action
      setPlaying(true)
    } else {
      action.paused = true
    }

    return () => {
      action.stop()
    }
  }, [action, mixer, mode, selectedClip])

  useEffect(
    () => () => {
      mixer.stopAllAction()
      for (const clip of animations) {
        actions[clip.name]?.stop()
        mixer.uncacheAction(clip, scene)
        mixer.uncacheClip(clip)
      }
      mixer.uncacheRoot(scene)
    },
    [actions, animations, mixer, scene],
  )

  const toggle = useCallback(() => {
    if (!action || !selectedClip || mode === "static") return

    if (playing) {
      action.paused = true
      setPlaying(false)
      return
    }

    action.enabled = true
    action.paused = false
    if (startedAction.current !== action) {
      action.play()
      startedAction.current = action
    }
    setPlaying(true)
  }, [action, mode, playing, selectedClip])

  const controls = useMemo<AnimationControlsState>(
    () => ({ available, playing: available && playing, toggle }),
    [available, playing, toggle],
  )

  useEffect(() => {
    onChange?.(controls)
  }, [controls, onChange])

  return null
}
