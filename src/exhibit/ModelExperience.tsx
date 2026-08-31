import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
  type Ref,
} from "react"
import type { Exhibit } from "../content/types"
import type { LightingPresetId } from "../content/types"
import type { AnimationControlsState } from "./AnimationController"
import { AtmosphereBackground } from "./AtmosphereBackground"
import { ModelErrorBoundary } from "./ModelErrorBoundary"
import { clearModelLoaderCache } from "./modelLoaderCache"
import { ModelScene, type ModelControlsHandle } from "./ModelScene"
import { sceneProfiles } from "./sceneProfiles"

export type ModelExperienceProps = {
  exhibit: Exhibit
  captureFrameScale?: number
  lightingPreset?: LightingPresetId
  onAnimationControlsChange?(state: AnimationControlsState): void
  onReady?: () => void
  controlsRef?: Ref<ModelControlsHandle>
}

export function hasWebGLSupport(): boolean {
  if (typeof document === "undefined") return false

  try {
    const canvas = document.createElement("canvas")
    return Boolean(canvas.getContext("webgl2") || canvas.getContext("webgl"))
  } catch {
    return false
  }
}

type ModelState = "unavailable" | "error" | "ready" | "loading"
const COVER_FADE_DURATION_MS = 420

export type ModelAttemptToken = {
  identity: string
  generation: object
  attempt: number
}

function isSameModelAttempt(left: ModelAttemptToken, right: ModelAttemptToken) {
  return (
    left.identity === right.identity &&
    left.generation === right.generation &&
    left.attempt === right.attempt
  )
}

export function bindModelAttemptCallback(
  getActiveAttempt: () => ModelAttemptToken,
  boundAttempt: ModelAttemptToken,
  callback: () => void,
) {
  return () => {
    if (!isSameModelAttempt(getActiveAttempt(), boundAttempt)) return
    callback()
  }
}

function statusFor(state: ModelState) {
  return state === "unavailable"
    ? "此设备无法使用三维查看器，正在显示封面图。"
    : state === "error"
      ? "三维模型加载失败。"
      : state === "ready"
        ? "三维模型已加载。"
        : "正在加载三维模型。"
}

function ModelExperienceShell({
  exhibit,
  state,
  children,
}: {
  exhibit: Exhibit
  state: ModelState
  children?: ReactNode
}) {
  const ready = state === "ready"
  const identity = `${exhibit.slug}:${exhibit.model}`
  const reducedMotion =
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-reduced-motion: reduce)").matches
  const [storedCover, setStoredCover] = useState({ identity, hidden: false })
  const coverTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const coverHidden =
    ready &&
    (reducedMotion || (storedCover.identity === identity && storedCover.hidden))

  useEffect(() => {
    if (coverTimer.current !== undefined) {
      clearTimeout(coverTimer.current)
      coverTimer.current = undefined
    }

    if (!ready || reducedMotion) return

    setStoredCover((current) =>
      current.identity === identity && !current.hidden
        ? current
        : { identity, hidden: false },
    )
    const timer = setTimeout(() => {
      setStoredCover((current) =>
        current.identity === identity ? { identity, hidden: true } : current,
      )
      if (coverTimer.current === timer) coverTimer.current = undefined
    }, COVER_FADE_DURATION_MS)
    coverTimer.current = timer

    return () => {
      clearTimeout(timer)
      if (coverTimer.current === timer) coverTimer.current = undefined
    }
  }, [identity, ready, reducedMotion])

  const finishCoverFade = () => {
    if (!ready || reducedMotion) return
    if (coverTimer.current !== undefined) {
      clearTimeout(coverTimer.current)
      coverTimer.current = undefined
    }
    setStoredCover({ identity, hidden: true })
  }

  return (
    <figure
      className="model-experience"
      data-model-state={state}
      data-testid="model-experience"
      style={{ margin: 0, position: "relative", overflow: "hidden" }}
    >
      <AtmosphereBackground palette={exhibit.presentation.palette} motion="edge-bloom" />
      <img
        className="model-experience__cover"
        data-cover-hidden={coverHidden ? "true" : "false"}
        src={exhibit.cover}
        alt={`${exhibit.title}封面`}
        decoding="async"
        onTransitionEnd={(event) => {
          if (event.propertyName === "opacity") finishCoverFade()
        }}
        style={{
          display: "block",
          height: "100%",
          inset: 0,
          objectFit: "cover",
          opacity: ready ? 0 : 1,
          position: "absolute",
          width: "100%",
        }}
      />

      {children}

      <figcaption className="model-experience__caption" style={{ position: "relative" }}>
        <p
          role={state === "error" ? "alert" : "status"}
          aria-live={state === "error" ? "assertive" : "polite"}
        >
          {statusFor(state)}
        </p>
      </figcaption>
    </figure>
  )
}

function WebGLModelExperience({
  exhibit,
  captureFrameScale,
  lightingPreset,
  onAnimationControlsChange,
  onReady,
  controlsRef,
}: ModelExperienceProps) {
  const identity = `${exhibit.slug}:${exhibit.model}`
  const mountGeneration = useMemo<object>(() => ({}), [identity])
  const [storedState, setStoredState] = useState<{
    identity: string
    generation: object
    attempt: number
    status: Exclude<ModelState, "unavailable">
  }>(() => ({ identity, generation: mountGeneration, attempt: 0, status: "loading" }))
  const notifiedInstance = useRef<ModelAttemptToken | null>(null)
  const profile = sceneProfiles[exhibit.presentation.scene]
  const camera = exhibit.presentation.camera ?? profile.defaultCamera
  const activeState =
    storedState.identity === identity && storedState.generation === mountGeneration
      ? storedState
      : { identity, generation: mountGeneration, attempt: 0, status: "loading" as const }
  const { attempt, status: state } = activeState
  const attemptToken = useMemo<ModelAttemptToken>(
    () => ({ identity, generation: mountGeneration, attempt }),
    [attempt, identity, mountGeneration],
  )
  const activeAttempt = useRef(attemptToken)
  activeAttempt.current = attemptToken
  const failed = state === "error"
  const ready = state === "ready"

  const handleReady = useMemo(
    () =>
      bindModelAttemptCallback(() => activeAttempt.current, attemptToken, () => {
        const notification = notifiedInstance.current
        if (notification && isSameModelAttempt(notification, attemptToken)) return

        notifiedInstance.current = attemptToken
        setStoredState({ ...attemptToken, status: "ready" })
        onReady?.()
      }),
    [attemptToken, onReady],
  )

  const handleError = useMemo(
    () =>
      bindModelAttemptCallback(() => activeAttempt.current, attemptToken, () => {
        setStoredState({ ...attemptToken, status: "error" })
      }),
    [attemptToken],
  )

  const retry = useCallback(() => {
    clearModelLoaderCache(exhibit.model)
    setStoredState({
      identity,
      generation: mountGeneration,
      attempt: attempt + 1,
      status: "loading",
    })
  }, [attempt, exhibit.model, identity, mountGeneration])

  return (
    <ModelExperienceShell exhibit={exhibit} state={state}>
      <div
        className="model-experience__canvas"
        aria-hidden={!ready && !failed}
        style={{
          minHeight: "24rem",
          opacity: ready || failed ? 1 : 0,
          position: "relative",
          zIndex: 1,
        }}
      >
        <ModelErrorBoundary
          key={`${identity}:${attempt}`}
          onError={handleError}
          fallback={() => (
            <button type="button" onClick={retry}>
              重新加载模型
            </button>
          )}
        >
          <ModelScene
            model={exhibit.model}
            profile={profile}
            camera={camera}
            frameScale={captureFrameScale}
            lightingPreset={lightingPreset ?? exhibit.presentation.lightingPresets[0]!}
            animation={exhibit.animation}
            onAnimationControlsChange={onAnimationControlsChange}
            onReady={handleReady}
            controlsRef={controlsRef}
          />
        </ModelErrorBoundary>
      </div>
    </ModelExperienceShell>
  )
}

export function ModelExperience({
  exhibit,
  captureFrameScale,
  lightingPreset,
  onAnimationControlsChange,
  onReady,
  controlsRef,
}: ModelExperienceProps) {
  const [webGLAvailable] = useState(hasWebGLSupport)

  if (!webGLAvailable) {
    return <ModelExperienceShell exhibit={exhibit} state="unavailable" />
  }

  return (
    <WebGLModelExperience
      exhibit={exhibit}
      captureFrameScale={captureFrameScale}
      lightingPreset={lightingPreset}
      onAnimationControlsChange={onAnimationControlsChange}
      onReady={onReady}
      controlsRef={controlsRef}
    />
  )
}
