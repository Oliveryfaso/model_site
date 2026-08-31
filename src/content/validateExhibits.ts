import type { Exhibit, ValidationResult } from "./types"

export type ExhibitValidationConfig = {
  themeTrack?: string
}

const allowedLayouts = new Set(["center-stage", "story-offset", "immersive"])
const allowedScenes = new Set(["warm-cabinet", "star-mist", "cold-chamber"])
const allowedLightingPresets = new Set([
  "warm",
  "rim",
  "moon",
  "starlight",
  "top",
  "scan",
])
const requiredStringFields = [
  "slug",
  "collectionNumber",
  "title",
  "summary",
  "description",
  "cover",
  "model",
] as const satisfies readonly (keyof Exhibit)[]
const safeSlugPattern = /^[a-z0-9]+(?:-[a-z0-9]+)*$/
const hexColorPattern = /^#[0-9a-f]{6}$/i

function isBlank(value: unknown): boolean {
  return typeof value !== "string" || value.trim().length === 0
}

export function isSafeLocalPublicPath(publicPath: string): boolean {
  if (isBlank(publicPath) || publicPath.trim() !== publicPath) return false
  if (!publicPath.startsWith("/") || publicPath.startsWith("//")) return false
  if (publicPath.includes("\\") || /[?#\0]/.test(publicPath)) return false

  const segments = publicPath.slice(1).split("/")
  if (segments.length === 0 || segments.some((segment) => segment.length === 0)) return false

  try {
    return segments.every((segment) => {
      const decoded = decodeURIComponent(segment)
      return (
        decoded !== "." &&
        decoded !== ".." &&
        !decoded.includes("/") &&
        !decoded.includes("\\") &&
        !decoded.includes("\0")
      )
    })
  } catch {
    return false
  }
}

type AssetValidation = {
  path: string
  kind: string
  missingKind: string
  required?: boolean
  requireGlb?: boolean
}

function validateAsset(
  asset: AssetValidation,
  assetIsFile: (publicPath: string) => boolean,
  errors: string[],
) {
  if (isBlank(asset.path)) {
    if (!asset.required) errors.push(`Blank configured ${asset.kind} path`)
    return
  }

  if (!isSafeLocalPublicPath(asset.path)) {
    errors.push(`Invalid local ${asset.kind} path: ${asset.path}`)
    return
  }

  if (asset.requireGlb && !asset.path.toLowerCase().endsWith(".glb")) {
    errors.push(`Model asset must use .glb: ${asset.path}`)
    return
  }

  if (!assetIsFile(asset.path)) {
    errors.push(`Missing ${asset.missingKind} asset: ${asset.path}`)
  }
}

export function validateExhibits(
  exhibits: readonly Exhibit[],
  assetIsFile: (publicPath: string) => boolean,
  config: ExhibitValidationConfig = {},
): ValidationResult {
  const errors: string[] = []
  const warnings: string[] = []
  const slugs = new Set<string>()
  const collectionNumbers = new Set<string>()
  let featuredCount = 0

  if (config.themeTrack !== undefined) {
    validateAsset(
      {
        path: config.themeTrack,
        kind: "theme audio",
        missingKind: "theme audio",
      },
      assetIsFile,
      errors,
    )
  }

  exhibits.forEach((exhibit, index) => {
    const label = exhibit.slug.trim() || `entry ${index + 1}`

    for (const field of requiredStringFields) {
      if (isBlank(exhibit[field])) {
        errors.push(`Blank required exhibit field: ${field} (${label})`)
      }
    }

    if (!isBlank(exhibit.slug) && !safeSlugPattern.test(exhibit.slug)) {
      errors.push(`Invalid exhibit slug: ${exhibit.slug}`)
    }

    if (!isBlank(exhibit.slug)) {
      if (slugs.has(exhibit.slug)) {
        errors.push(`Duplicate exhibit slug: ${exhibit.slug}`)
      } else {
        slugs.add(exhibit.slug)
      }
    }

    if (!isBlank(exhibit.collectionNumber)) {
      if (collectionNumbers.has(exhibit.collectionNumber)) {
        errors.push(`Duplicate collection number: ${exhibit.collectionNumber}`)
      } else {
        collectionNumbers.add(exhibit.collectionNumber)
      }
    }

    if (exhibit.featured) featuredCount += 1

    if (exhibit.tags.length === 0) {
      errors.push(`Empty exhibit tags: ${label}`)
    }
    exhibit.tags.forEach((tag, tagIndex) => {
      if (isBlank(tag)) errors.push(`Blank exhibit tag at index ${tagIndex}: ${label}`)
    })

    if (!allowedLayouts.has(exhibit.presentation.layout)) {
      errors.push(`Unknown exhibit layout: ${exhibit.presentation.layout} (${label})`)
    }
    if (!allowedScenes.has(exhibit.presentation.scene)) {
      errors.push(`Unknown scene: ${exhibit.presentation.scene} (${label})`)
    }
    if (exhibit.presentation.lightingPresets.length === 0) {
      errors.push(`Empty lighting presets: ${exhibit.slug}`)
    }
    for (const preset of exhibit.presentation.lightingPresets) {
      if (!allowedLightingPresets.has(preset)) {
        errors.push(`Unknown lighting preset: ${preset} (${label})`)
      }
    }

    const palette = exhibit.presentation.palette as unknown
    if (!Array.isArray(palette)) {
      errors.push(`Missing exhibit atmosphere palette: ${label}`)
    } else if (
      palette.length !== 3 ||
      palette.some((color) => typeof color !== "string" || !hexColorPattern.test(color))
    ) {
      errors.push(`Invalid exhibit atmosphere palette: ${label}`)
    }

    validateAsset(
      { path: exhibit.cover, kind: "cover", missingKind: "cover", required: true },
      assetIsFile,
      errors,
    )
    validateAsset(
      {
        path: exhibit.model,
        kind: "model",
        missingKind: "model",
        required: true,
        requireGlb: true,
      },
      assetIsFile,
      errors,
    )

    if (exhibit.audio) {
      validateAsset(
        {
          path: exhibit.audio.ambientTrack,
          kind: "audio",
          missingKind: "audio",
        },
        assetIsFile,
        errors,
      )
    }

    if (exhibit.share?.image !== undefined) {
      validateAsset(
        {
          path: exhibit.share.image,
          kind: "share image",
          missingKind: "share image",
        },
        assetIsFile,
        errors,
      )
    }
  })

  if (featuredCount > 1) {
    errors.push(`Expected at most one featured exhibit, found ${featuredCount}`)
  }

  return { errors, warnings }
}
