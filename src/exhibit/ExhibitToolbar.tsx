import { useEffect, useRef, useState, type RefObject } from "react"
import { SoundToggle } from "../audio/SoundToggle"
import type { Exhibit, LightingPresetId } from "../content/types"
import {
  createBrowserShareEnvironment,
  shareExhibit,
  type ShareEnvironment,
} from "../sharing/shareExhibit"
import type { AnimationControlsState } from "./AnimationController"
import { lightingPresets } from "./lightingPresets"
import type { ModelControlsHandle } from "./ModelScene"

const COMPACT_TOOLBAR_QUERY = "(max-width: 48rem)"

function useCompactToolbar() {
  const readCompact = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(COMPACT_TOOLBAR_QUERY).matches
  const [compact, setCompact] = useState(readCompact)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia(COMPACT_TOOLBAR_QUERY)
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return compact
}

export function ExhibitToolbar({
  animation,
  controlsRef,
  exhibit,
  lightingPreset,
  lightingOptions,
  onLightingChange,
  shareEnvironment,
  viewerRef,
}: {
  animation?: AnimationControlsState
  controlsRef: RefObject<ModelControlsHandle | null>
  exhibit: Exhibit
  lightingPreset: LightingPresetId
  lightingOptions: readonly LightingPresetId[]
  onLightingChange(preset: LightingPresetId): void
  shareEnvironment?: ShareEnvironment
  viewerRef: RefObject<HTMLDivElement | null>
}) {
  const compact = useCompactToolbar()
  const [copied, setCopied] = useState(false)
  const copiedTimer = useRef<ReturnType<typeof setTimeout>>(undefined)
  const mounted = useRef(false)
  const exhibitIdentity = `${exhibit.slug}:${exhibit.model}`
  const activeExhibitIdentity = useRef(exhibitIdentity)
  const shareGeneration = useRef(0)
  activeExhibitIdentity.current = exhibitIdentity

  useEffect(() => {
    mounted.current = true
    shareGeneration.current += 1
    setCopied(false)
    if (copiedTimer.current !== undefined) {
      clearTimeout(copiedTimer.current)
      copiedTimer.current = undefined
    }
    return () => {
      mounted.current = false
      shareGeneration.current += 1
      if (copiedTimer.current !== undefined) {
        clearTimeout(copiedTimer.current)
        copiedTimer.current = undefined
      }
    }
  }, [exhibitIdentity])

  const share = async () => {
    const requestGeneration = shareGeneration.current + 1
    shareGeneration.current = requestGeneration
    const requestExhibitIdentity = exhibitIdentity
    setCopied(false)
    if (copiedTimer.current !== undefined) {
      clearTimeout(copiedTimer.current)
      copiedTimer.current = undefined
    }
    const requestIsCurrent = () =>
      mounted.current &&
      activeExhibitIdentity.current === requestExhibitIdentity &&
      shareGeneration.current === requestGeneration

    try {
      const result = await shareExhibit(
        exhibit,
        shareEnvironment ?? createBrowserShareEnvironment(),
      )
      if (result !== "copied" || !requestIsCurrent()) return

      setCopied(true)
      copiedTimer.current = setTimeout(() => {
        if (!requestIsCurrent()) return
        setCopied(false)
        copiedTimer.current = undefined
      }, 2_000)
    } catch (error) {
      if (!requestIsCurrent()) return
      console.warn("无法分享这件藏品。", error)
    }
  }

  const enterFullscreen = () => {
    const target = viewerRef.current
    if (!target?.requestFullscreen) {
      console.warn("当前浏览器不支持全屏查看。")
      return
    }

    try {
      void Promise.resolve(target.requestFullscreen()).catch((error: unknown) => {
        console.warn("无法进入全屏查看。", error)
      })
    } catch (error) {
      console.warn("无法进入全屏查看。", error)
    }
  }

  return (
    <nav className="exhibit-toolbar" aria-label="三维查看器工具">
      <div className="exhibit-toolbar__primary">
        <button type="button" onClick={() => controlsRef.current?.resetCamera()}>
          重置镜头
        </button>
        <button type="button" onClick={enterFullscreen}>
          全屏查看
        </button>
        <SoundToggle />
        <button type="button" onClick={() => void share()}>
          分享藏品
        </button>
        <span className="exhibit-toolbar__share-status" aria-live="polite">
          {copied ? "链接已复制" : null}
        </span>
        {animation?.available ? (
          <button type="button" aria-pressed={animation.playing} onClick={animation.toggle}>
            {animation.playing ? "暂停动画" : "播放动画"}
          </button>
        ) : null}
      </div>

      <details className="exhibit-toolbar__secondary" open={!compact}>
        <summary>灯光设置</summary>
        <div className="exhibit-toolbar__lights" aria-label="灯光预设">
          {lightingOptions.map((preset) => (
            <button
              key={preset}
              type="button"
              aria-label={`切换到${lightingPresets[preset].label}灯光`}
              aria-pressed={lightingPreset === preset}
              onClick={() => onLightingChange(preset)}
            >
              {lightingPresets[preset].label}
            </button>
          ))}
        </div>
      </details>
    </nav>
  )
}
