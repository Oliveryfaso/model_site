import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useLocation } from "react-router-dom"
import { siteConfig } from "../app/siteConfig"
import { AudioDirector } from "./AudioDirector"

type AudioContextValue = {
  enabled: boolean
  toggle(): Promise<void>
  resetExhibitTrack(): void
  activateExhibitTrack(track?: string): void
}

const AudioContext = createContext<AudioContextValue | null>(null)

function isExhibitPath(pathname: string) {
  return /^\/exhibits\/[^/]+\/?$/.test(pathname)
}

function getPreferenceStorage() {
  if (typeof window === "undefined") return undefined
  if (typeof navigator !== "undefined" && /jsdom/i.test(navigator.userAgent)) {
    const descriptor = Object.getOwnPropertyDescriptor(globalThis, "localStorage")
    if (!descriptor || !Object.prototype.hasOwnProperty.call(descriptor, "value")) {
      return undefined
    }
  }
  try {
    return window.localStorage
  } catch {
    return undefined
  }
}

export function AudioProvider({ children }: { children: ReactNode }) {
  const location = useLocation()
  const [enabled, setEnabled] = useState(false)
  const mounted = useRef(true)
  const disposalTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined)
  const exhibitRoute = useRef(isExhibitPath(location.pathname))
  exhibitRoute.current = isExhibitPath(location.pathname)
  const [director] = useState(
    () =>
      new AudioDirector({
        themeSrc: siteConfig.themeTrack,
        createTrack: (src) => new Audio(src),
        storage: getPreferenceStorage(),
        onEnabledChange: (nextEnabled) => {
          if (mounted.current) setEnabled(nextEnabled)
        },
      }),
  )

  useEffect(() => {
    if (exhibitRoute.current) director.enterExhibit(undefined)
    else director.enterCollection()
  }, [director, location.pathname])

  useEffect(() => {
    let active = true
    void director.restoreStoredPreference().then((restored) => {
      if (!active || !restored) return
      if (document.visibilityState === "hidden") director.suspend()
    })

    return () => {
      active = false
    }
  }, [director])

  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "hidden") director.suspend()
      else director.resume()
    }
    document.addEventListener("visibilitychange", handleVisibilityChange)

    return () => {
      document.removeEventListener("visibilitychange", handleVisibilityChange)
    }
  }, [director])

  useEffect(() => {
    mounted.current = true
    if (disposalTimer.current) clearTimeout(disposalTimer.current)
    disposalTimer.current = undefined

    return () => {
      mounted.current = false
      disposalTimer.current = setTimeout(() => director.dispose(), 0)
    }
  }, [director])

  const toggle = useCallback(async () => {
    if (director.isEnabled()) {
      director.disable()
      return
    }
    const didEnable = await director.enable()
    if (didEnable && document.visibilityState === "hidden") director.suspend()
  }, [director])

  const resetExhibitTrack = useCallback(() => {
    if (!exhibitRoute.current) return
    director.enterExhibit(undefined)
  }, [director])

  const activateExhibitTrack = useCallback(
    (track?: string) => {
      if (!exhibitRoute.current) return
      director.enterExhibit(track)
    },
    [director],
  )

  const value = useMemo<AudioContextValue>(
    () => ({ enabled, toggle, resetExhibitTrack, activateExhibitTrack }),
    [activateExhibitTrack, enabled, resetExhibitTrack, toggle],
  )

  return <AudioContext.Provider value={value}>{children}</AudioContext.Provider>
}

export function useAudio() {
  const audio = useContext(AudioContext)
  if (!audio) throw new Error("useAudio must be used within AudioProvider")
  return audio
}
