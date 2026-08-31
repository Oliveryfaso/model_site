import { useEffect, useState } from "react"
import type { SceneProfile } from "./sceneProfiles"

export type PerformanceTier = { mobile: boolean; dpr: [number, number]; shadows: boolean }

export type PerformanceSignals = {
  mobile: boolean
  deviceMemory?: number
  devicePixelRatio: number
}

export function resolvePerformanceTier(
  profile: SceneProfile,
  signals: PerformanceSignals,
): PerformanceTier {
  const lowMemory = signals.deviceMemory !== undefined && signals.deviceMemory <= 4
  const configuredMax = Math.max(1, profile.mobile.maxDpr)
  const maxDpr = lowMemory
    ? 1
    : Math.max(1, Math.min(signals.devicePixelRatio, configuredMax))

  return {
    mobile: signals.mobile,
    dpr: [1, maxDpr],
    shadows: lowMemory ? false : signals.mobile ? profile.mobile.shadows : true,
  }
}

function readDeviceMemory(): number | undefined {
  if (typeof navigator === "undefined") return undefined
  return (navigator as Navigator & { deviceMemory?: number }).deviceMemory
}

function readPixelRatio(): number {
  if (typeof window === "undefined") return 1
  return window.devicePixelRatio || 1
}

export function usePerformanceTier(profile: SceneProfile): PerformanceTier {
  const [mobile, setMobile] = useState(() =>
    typeof window === "undefined" || typeof window.matchMedia !== "function"
      ? false
      : window.matchMedia("(max-width: 720px)").matches,
  )

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") return

    const query = window.matchMedia("(max-width: 720px)")
    const update = (event: MediaQueryListEvent | MediaQueryList) => setMobile(event.matches)
    update(query)
    query.addEventListener?.("change", update)

    return () => query.removeEventListener?.("change", update)
  }, [])

  return resolvePerformanceTier(profile, {
    mobile,
    deviceMemory: readDeviceMemory(),
    devicePixelRatio: readPixelRatio(),
  })
}
