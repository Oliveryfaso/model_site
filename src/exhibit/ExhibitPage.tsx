import {
  lazy,
  Suspense,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type CSSProperties,
} from "react"
import { Link, useLocation, useParams } from "react-router-dom"
import { useAudio } from "../audio/AudioProvider"
import { getExhibitBySlug } from "../content/catalog"
import type { CameraPreset, Exhibit, LightingPresetId } from "../content/types"
import { NotFoundPage } from "../pages/NotFoundPage"
import "../styles/exhibit.css"
import type { AnimationControlsState } from "./AnimationController"
import { ExhibitLayout } from "./ExhibitLayout"
import { ExhibitToolbar } from "./ExhibitToolbar"
import type { ModelControlsHandle } from "./ModelScene"
import { sceneProfiles } from "./sceneProfiles"

const ModelExperience = lazy(() =>
  import("./ModelExperience").then((module) => ({ default: module.ModelExperience })),
)

function ViewerFallback({ exhibit }: { exhibit: Exhibit }) {
  return (
    <figure className="model-experience model-experience--fallback" aria-busy="true">
      <img src={exhibit.cover} alt={`${exhibit.title}封面`} />
      <figcaption>
        <p role="status" aria-live="polite">
          正在准备三维查看器。
        </p>
      </figcaption>
    </figure>
  )
}

const COMPACT_EXHIBIT_QUERY = "(max-width: 48rem)"
const COVER_CAPTURE_CAMERA_PAN_Y = -0.25
const COVER_CAPTURE_CAMERA_DISTANCE = 1.35
const COVER_CAPTURE_FRAME_SCALE = 0.78
const INTERACTIVE_CAMERA_DISTANCE = 1.4
const INTERACTIVE_FRAME_SCALE = 0.72
const INTERACTIVE_CAMERA_PAN_Y = -0.22
const COMPACT_CAMERA_DISTANCE = 2.45
const COMPACT_FRAME_SCALE = 0.6
const COMPACT_CAMERA_PAN_Y = -0.5

function frameCoverCaptureCamera(camera: CameraPreset): CameraPreset {
  const target = [
    camera.target[0],
    camera.target[1] + COVER_CAPTURE_CAMERA_PAN_Y,
    camera.target[2],
  ] as const
  return {
    ...camera,
    position: [
      target[0] + (camera.position[0] - camera.target[0]) * COVER_CAPTURE_CAMERA_DISTANCE,
      target[1] + (camera.position[1] - camera.target[1]) * COVER_CAPTURE_CAMERA_DISTANCE,
      target[2] + (camera.position[2] - camera.target[2]) * COVER_CAPTURE_CAMERA_DISTANCE,
    ],
    target,
  }
}

function frameInteractiveCamera(camera: CameraPreset, compact: boolean): CameraPreset {
  const distanceScale = compact ? COMPACT_CAMERA_DISTANCE : INTERACTIVE_CAMERA_DISTANCE
  const panY = compact ? COMPACT_CAMERA_PAN_Y : INTERACTIVE_CAMERA_PAN_Y
  const target = [
    camera.target[0],
    camera.target[1] + panY,
    camera.target[2],
  ] as const
  const position = [
    target[0] + (camera.position[0] - camera.target[0]) * distanceScale,
    target[1] + (camera.position[1] - camera.target[1]) * distanceScale,
    target[2] + (camera.position[2] - camera.target[2]) * distanceScale,
  ] as const
  const distance = Math.hypot(
    position[0] - target[0],
    position[1] - target[1],
    position[2] - target[2],
  )
  return {
    ...camera,
    position,
    target,
    maxDistance: Math.max(camera.maxDistance, distance * 1.08),
  }
}

function useCompactExhibit() {
  const readCompact = () =>
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia(COMPACT_EXHIBIT_QUERY).matches
  const [compact, setCompact] = useState(readCompact)

  useEffect(() => {
    if (typeof window.matchMedia !== "function") return
    const media = window.matchMedia(COMPACT_EXHIBIT_QUERY)
    const update = () => setCompact(media.matches)
    update()
    media.addEventListener("change", update)
    return () => media.removeEventListener("change", update)
  }, [])

  return compact
}

function ExhibitInformation({ exhibit }: { exhibit: Exhibit }) {
  const compact = useCompactExhibit()
  const [open, setOpen] = useState(false)
  const expanded = !compact || open
  const bodyId = `exhibit-information-${exhibit.slug}`

  return (
    <section className="exhibit-information" aria-labelledby="exhibit-title" tabIndex={0}>
      <p className="eyebrow">藏品 {exhibit.collectionNumber}</p>
      <h1 id="exhibit-title">{exhibit.title}</h1>
      <button
        className="exhibit-information__disclosure"
        type="button"
        aria-controls={bodyId}
        aria-expanded={expanded}
        hidden={!compact}
        onClick={() => setOpen((current) => !current)}
      >
        查看藏品说明
      </button>

      <div
        id={bodyId}
        className="exhibit-information__body"
        aria-hidden={!expanded}
        inert={!expanded}
        data-open={expanded ? "true" : "false"}
      >
        <p className="exhibit-information__summary">{exhibit.summary}</p>
        <p className="exhibit-information__description">{exhibit.description}</p>

        <dl className="exhibit-information__metadata">
          <div>
            <dt>分类</dt>
            <dd>
              <ul className="exhibit-information__tags" aria-label="藏品标签">
                {exhibit.tags.map((tag) => (
                  <li key={tag}>{tag}</li>
                ))}
              </ul>
            </dd>
          </div>
          {exhibit.year ? (
            <div>
              <dt>年份</dt>
              <dd>{exhibit.year}</dd>
            </div>
          ) : null}
          {exhibit.tools?.length ? (
            <div>
              <dt>工具</dt>
              <dd>{exhibit.tools.join("、")}</dd>
            </div>
          ) : null}
        </dl>
      </div>
    </section>
  )
}

function ExhibitDetail({ exhibit }: { exhibit: Exhibit }) {
  const { search } = useLocation()
  const captureOnly = new URLSearchParams(search).get("capture") === "cover"
  const compact = useCompactExhibit()
  const { activateExhibitTrack, resetExhibitTrack } = useAudio()
  const controlsRef = useRef<ModelControlsHandle>(null)
  const viewerRef = useRef<HTMLDivElement>(null)
  const identity = `${exhibit.slug}:${exhibit.model}`
  const activeAudioIdentity = useRef(identity)
  activeAudioIdentity.current = identity
  useEffect(() => {
    resetExhibitTrack()
  }, [identity, resetExhibitTrack])
  const handleModelReady = useCallback(() => {
    if (activeAudioIdentity.current !== identity) return
    activateExhibitTrack(exhibit.audio?.ambientTrack)
  }, [activateExhibitTrack, exhibit.audio?.ambientTrack, identity])
  const firstLightingPreset = exhibit.presentation.lightingPresets[0]!
  const [storedVisit, setStoredVisit] = useState<{
    identity: string
    generation: object
    lightingPreset: LightingPresetId
    animation?: AnimationControlsState
  }>(() => ({ identity, generation: {}, lightingPreset: firstLightingPreset }))
  let visit = storedVisit
  if (storedVisit.identity !== identity) {
    visit = { identity, generation: {}, lightingPreset: firstLightingPreset }
    setStoredVisit(visit)
  }
  const visitGeneration = visit.generation
  const lightingPreset = exhibit.presentation.lightingPresets.includes(visit.lightingPreset)
    ? visit.lightingPreset
    : firstLightingPreset
  const handleAnimationChange = useCallback(
    (state: AnimationControlsState) => {
      setStoredVisit((current) =>
        current.generation === visitGeneration ? { ...current, animation: state } : current,
      )
    },
    [visitGeneration],
  )
  const profile = sceneProfiles[exhibit.presentation.scene]
  const viewerExhibit = useMemo(
    () => ({
      ...exhibit,
      presentation: {
        ...exhibit.presentation,
        camera: captureOnly
          ? frameCoverCaptureCamera(exhibit.presentation.camera ?? profile.defaultCamera)
          : frameInteractiveCamera(exhibit.presentation.camera ?? profile.defaultCamera, compact),
      },
    }),
    [captureOnly, compact, exhibit, profile.defaultCamera],
  )
  const pageStyle = {
    "--exhibit-scene": exhibit.presentation.background ?? profile.background,
  } as CSSProperties
  const viewerStyle = {
    viewTransitionName: `exhibit-cover-${exhibit.slug}`,
  } as CSSProperties

  const viewer = (
    <div
      ref={viewerRef}
      className="exhibit-viewer"
      data-scene={exhibit.presentation.scene}
      style={viewerStyle}
    >
      <Suspense fallback={<ViewerFallback exhibit={exhibit} />}>
        <ModelExperience
          exhibit={viewerExhibit}
          captureFrameScale={
            captureOnly
              ? COVER_CAPTURE_FRAME_SCALE
              : compact
                ? COMPACT_FRAME_SCALE
                : INTERACTIVE_FRAME_SCALE
          }
          lightingPreset={lightingPreset}
          onAnimationControlsChange={handleAnimationChange}
          onReady={handleModelReady}
          controlsRef={controlsRef}
        />
      </Suspense>
    </div>
  )
  const information = <ExhibitInformation key={identity} exhibit={exhibit} />
  const toolbar = (
    <ExhibitToolbar
      animation={visit.animation}
      controlsRef={controlsRef}
      exhibit={exhibit}
      lightingPreset={lightingPreset}
      lightingOptions={exhibit.presentation.lightingPresets}
      onLightingChange={(preset) => {
        if (!exhibit.presentation.lightingPresets.includes(preset)) return
        setStoredVisit((current) =>
          current.generation === visitGeneration
            ? { ...current, lightingPreset: preset }
            : current,
        )
      }}
      viewerRef={viewerRef}
    />
  )

  return (
    <article
      className={`exhibit-page${captureOnly ? " exhibit-page--capture" : ""}`}
      aria-label={captureOnly ? `${exhibit.title}封面捕捉舞台` : undefined}
      aria-labelledby={captureOnly ? undefined : "exhibit-title"}
      style={pageStyle}
    >
      {captureOnly ? null : (
        <div className="exhibit-page__masthead">
          <Link className="exhibit-page__back" to="/">
            <span aria-hidden="true">←</span> 返回馆藏
          </Link>
          <p>{profile.allowedLighting.includes(lightingPreset) ? "展柜已就绪" : "默认灯光"}</p>
        </div>
      )}
      <ExhibitLayout
        captureOnly={captureOnly}
        layout={exhibit.presentation.layout}
        viewer={viewer}
        information={information}
        toolbar={toolbar}
      />
    </article>
  )
}

export function ExhibitPage() {
  const { slug } = useParams()
  const exhibit = slug ? getExhibitBySlug(slug) : undefined

  if (!exhibit) return <NotFoundPage />

  return <ExhibitDetail exhibit={exhibit} />
}
