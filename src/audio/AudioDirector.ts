export type AudioTrack = Pick<
  HTMLAudioElement,
  "play" | "pause" | "volume" | "currentTime" | "loop"
>

export type CreateTrack = (src: string) => AudioTrack

const soundPreferenceKey = "digital-figure-gallery:sound-enabled"
const COLLECTION_THEME_VOLUME = 0.3
const EXHIBIT_THEME_BED_VOLUME = 0.16
const AMBIENT_THEME_BED_VOLUME = 0.12
const AMBIENT_VOLUME = 0.45

type DesiredRoute =
  | { kind: "collection" }
  | { kind: "exhibit"; ambientSrc?: string }

function clampVolume(value: number) {
  return Math.max(0, Math.min(1, value))
}

export class AudioDirector {
  private readonly createTrack: CreateTrack
  private readonly durationMs: number
  private readonly storage?: Pick<Storage, "getItem" | "setItem">
  private readonly themeSrc: string
  private readonly onEnabledChange?: (enabled: boolean) => void
  private theme?: AudioTrack
  private ambient?: { src: string; track: AudioTrack }
  private desired: DesiredRoute = { kind: "collection" }
  private enabled = false
  private suspended = false
  private disposed = false
  private fadeTimer?: ReturnType<typeof setInterval>
  private transitionGeneration = 0
  private enableGeneration = 0
  private routeGeneration = 0
  private storedOptIn = false
  private activationPromise?: Promise<boolean>
  private persistOnActivation = false

  constructor(options: {
    themeSrc: string
    createTrack: CreateTrack
    durationMs?: number
    storage?: Pick<Storage, "getItem" | "setItem">
    onEnabledChange?: (enabled: boolean) => void
  }) {
    this.createTrack = options.createTrack
    this.durationMs = options.durationMs ?? 1_000
    this.storage = options.storage
    this.themeSrc = options.themeSrc
    this.onEnabledChange = options.onEnabledChange
    this.storedOptIn = this.readStoredPreference()
  }

  isEnabled() {
    return this.enabled
  }

  enable(): Promise<boolean> {
    return this.activate(true)
  }

  restoreStoredPreference(): Promise<boolean> {
    if (!this.storedOptIn) return Promise.resolve(false)
    return this.activate(false)
  }

  private activate(persistOnSuccess: boolean): Promise<boolean> {
    if (this.disposed) return Promise.resolve(false)
    if (this.enabled) return Promise.resolve(true)

    this.persistOnActivation ||= persistOnSuccess
    if (this.activationPromise) return this.activationPromise

    const activation = this.performActivation()
    this.activationPromise = activation
    void activation.finally(() => {
      if (this.activationPromise !== activation) return
      this.activationPromise = undefined
      this.persistOnActivation = false
    })
    return activation
  }

  private async performActivation(): Promise<boolean> {
    const generation = ++this.enableGeneration
    const routeGeneration = this.routeGeneration
    const theme = this.ensureTheme()
    const desiredAmbient =
      this.desired.kind === "exhibit" && this.desired.ambientSrc
        ? this.ensureAmbient(this.desired.ambientSrc)
        : undefined

    theme.volume = desiredAmbient
      ? AMBIENT_THEME_BED_VOLUME
      : this.desired.kind === "collection"
        ? COLLECTION_THEME_VOLUME
        : EXHIBIT_THEME_BED_VOLUME
    if (desiredAmbient) desiredAmbient.volume = 0

    try {
      await Promise.all([theme, desiredAmbient].filter(Boolean).map((track) => track!.play()))
    } catch {
      if (generation === this.enableGeneration) {
        this.failPlayback()
      }
      return false
    }

    if (
      generation !== this.enableGeneration ||
      routeGeneration !== this.routeGeneration ||
      this.disposed
    ) {
      return false
    }

    this.enabled = true
    this.onEnabledChange?.(true)
    this.suspended = false
    if (this.persistOnActivation) this.writeStoredPreference(true)
    this.syncToDesiredRoute(true)
    return true
  }

  disable() {
    if (this.disposed) return
    this.enableGeneration += 1
    this.enabled = false
    this.onEnabledChange?.(false)
    this.suspended = false
    this.cancelFade()
    this.stopAndReset(this.theme)
    this.stopAndReset(this.ambient?.track)
    this.ambient = undefined
    this.writeStoredPreference(false)
  }

  enterCollection() {
    this.setDesiredRoute({ kind: "collection" })
  }

  enterExhibit(track?: string) {
    this.setDesiredRoute({ kind: "exhibit", ambientSrc: track })
  }

  suspend() {
    if (!this.enabled || this.suspended || this.disposed) return
    this.suspended = true
    this.cancelFade()
    this.theme?.pause()
    this.ambient?.track.pause()
  }

  resume() {
    if (!this.enabled || !this.suspended || this.disposed) return
    this.suspended = false
    this.syncToDesiredRoute()
  }

  dispose() {
    if (this.disposed) return
    this.disposed = true
    this.enableGeneration += 1
    this.enabled = false
    this.onEnabledChange?.(false)
    this.cancelFade()
    this.stopAndReset(this.theme)
    this.stopAndReset(this.ambient?.track)
    this.theme = undefined
    this.ambient = undefined
  }

  private setDesiredRoute(desired: DesiredRoute) {
    if (this.disposed) return
    if (desired.kind === "collection" && this.desired.kind === "collection") return
    if (
      desired.kind === "exhibit" &&
      this.desired.kind === "exhibit" &&
      desired.ambientSrc === this.desired.ambientSrc
    ) return
    this.routeGeneration += 1
    this.desired = desired

    if (!this.enabled) {
      if (this.enableGeneration > 0 && (this.theme || this.ambient)) {
        this.enableGeneration += 1
        this.cancelFade()
        this.stopAndReset(this.theme)
        this.stopAndReset(this.ambient?.track)
        this.ambient = undefined
      }
      return
    }

    if (!this.suspended) this.syncToDesiredRoute()
  }

  private ensureTheme() {
    if (!this.theme) {
      this.theme = this.createTrack(this.themeSrc)
      this.theme.loop = true
    }
    return this.theme
  }

  private ensureAmbient(src: string) {
    if (this.ambient?.src === src) return this.ambient.track

    this.stopAndReset(this.ambient?.track)
    const track = this.createTrack(src)
    track.loop = true
    track.volume = 0
    this.ambient = { src, track }
    return track
  }

  private syncToDesiredRoute(alreadyPlaying = false) {
    if (!this.enabled || this.suspended || this.disposed) return
    const routeGeneration = this.routeGeneration
    const theme = this.ensureTheme()

    if (this.desired.kind === "exhibit" && this.desired.ambientSrc) {
      const ambient = this.ensureAmbient(this.desired.ambientSrc)
      if (!alreadyPlaying) {
        this.playAndMonitor(theme, routeGeneration)
        this.playAndMonitor(ambient, routeGeneration)
      }
      this.fade(theme, AMBIENT_THEME_BED_VOLUME, ambient, AMBIENT_VOLUME)
      return
    }

    const targetThemeVolume = this.desired.kind === "collection"
      ? COLLECTION_THEME_VOLUME
      : EXHIBIT_THEME_BED_VOLUME
    const ambient = this.ambient?.track
    if (!alreadyPlaying) this.playAndMonitor(theme, routeGeneration)
    if (!ambient) {
      this.fade(theme, targetThemeVolume)
      return
    }

    if (!alreadyPlaying) this.playAndMonitor(ambient, routeGeneration)
    this.fade(theme, targetThemeVolume, ambient, 0, () => {
      if (this.ambient?.track !== ambient) return
      this.stopAndReset(ambient)
      this.ambient = undefined
    })
  }

  private playAndMonitor(track: AudioTrack, routeGeneration: number) {
    try {
      void Promise.resolve(track.play()).catch(() => {
        if (routeGeneration !== this.routeGeneration || !this.enabled) return
        this.failPlayback()
      })
    } catch {
      if (routeGeneration === this.routeGeneration && this.enabled) {
        this.failPlayback()
      }
    }
  }

  private failPlayback() {
    this.enableGeneration += 1
    this.enabled = false
    this.onEnabledChange?.(false)
    this.suspended = false
    this.cancelFade()
    this.stopAndReset(this.theme)
    this.stopAndReset(this.ambient?.track)
    this.ambient = undefined
  }

  private readStoredPreference() {
    try {
      return this.storage?.getItem(soundPreferenceKey) === "true"
    } catch {
      return false
    }
  }

  private writeStoredPreference(enabled: boolean) {
    this.storedOptIn = enabled
    try {
      this.storage?.setItem(soundPreferenceKey, enabled ? "true" : "false")
    } catch {
      // Playback state remains authoritative when browser storage is unavailable.
    }
  }

  private fade(
    theme: AudioTrack,
    themeTarget: number,
    ambient?: AudioTrack,
    ambientTarget = 0,
    onComplete?: () => void,
  ) {
    this.cancelFade()
    const generation = this.transitionGeneration
    const themeStart = theme.volume
    const ambientStart = ambient?.volume ?? 0

    if (this.durationMs <= 0) {
      theme.volume = clampVolume(themeTarget)
      if (ambient) ambient.volume = clampVolume(ambientTarget)
      onComplete?.()
      return
    }

    const steps = 20
    const intervalMs = this.durationMs / steps
    let step = 0
    this.fadeTimer = setInterval(() => {
      if (generation !== this.transitionGeneration) return
      step += 1
      const progress = Math.min(1, step / steps)
      theme.volume = clampVolume(themeStart + (themeTarget - themeStart) * progress)
      if (ambient) {
        ambient.volume = clampVolume(
          ambientStart + (ambientTarget - ambientStart) * progress,
        )
      }

      if (progress < 1) return
      this.cancelFade()
      onComplete?.()
    }, intervalMs)
  }

  private cancelFade() {
    this.transitionGeneration += 1
    if (this.fadeTimer) clearInterval(this.fadeTimer)
    this.fadeTimer = undefined
  }

  private stopAndReset(track?: AudioTrack) {
    if (!track) return
    track.pause()
    try {
      track.currentTime = 0
    } catch {
      // Some browsers reject currentTime changes before metadata is available.
    }
  }
}
