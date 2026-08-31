import type { Exhibit } from "../content/types"

export type ShareEnvironment = {
  origin: string
  canNativeShare: boolean
  share(data: ShareData): Promise<void>
  writeText(text: string): Promise<void>
}

export type ShareResult = "shared" | "copied" | "cancelled"

function canonicalExhibitUrl(origin: string, slug: string): string {
  return `${origin.replace(/\/+$/, "")}/exhibits/${encodeURIComponent(slug)}/`
}

function isAbortError(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "AbortError"
  )
}

export function createBrowserShareEnvironment(): ShareEnvironment {
  return {
    origin: window.location.origin,
    canNativeShare: typeof navigator.share === "function",
    share(data) {
      return navigator.share(data)
    },
    writeText(text) {
      if (!navigator.clipboard?.writeText) {
        return Promise.reject(new Error("Clipboard writing is unavailable"))
      }
      return navigator.clipboard.writeText(text)
    },
  }
}

export async function shareExhibit(
  exhibit: Exhibit,
  environment: ShareEnvironment,
): Promise<ShareResult> {
  const url = canonicalExhibitUrl(environment.origin, exhibit.slug)

  if (environment.canNativeShare) {
    try {
      await environment.share({
        title: exhibit.share?.title ?? exhibit.title,
        text: exhibit.share?.description ?? exhibit.summary,
        url,
      })
      return "shared"
    } catch (error) {
      if (isAbortError(error)) return "cancelled"
    }
  }

  await environment.writeText(url)
  return "copied"
}
