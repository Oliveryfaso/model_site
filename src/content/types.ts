export type SceneId = "warm-cabinet" | "star-mist" | "cold-chamber"
export type ExhibitLayoutId = "center-stage" | "story-offset" | "immersive"
export type LightingPresetId = "warm" | "rim" | "moon" | "starlight" | "top" | "scan"
export type ExhibitPalette = readonly [string, string, string]

export type CameraPreset = {
  position: readonly [number, number, number]
  target: readonly [number, number, number]
  minDistance: number
  maxDistance: number
}

export type Exhibit = {
  slug: string
  collectionNumber: string
  title: string
  summary: string
  description: string
  tags: string[]
  year?: string
  tools?: string[]
  cover: string
  model: string
  featured?: boolean
  presentation: {
    layout: ExhibitLayoutId
    scene: SceneId
    palette: ExhibitPalette
    background?: string
    camera?: CameraPreset
    lightingPresets: LightingPresetId[]
  }
  animation?: {
    mode: "static" | "autoplay" | "manual"
    clip?: string
  }
  audio?: { ambientTrack: string }
  share?: { title?: string; description?: string; image?: string }
  attribution?: { creator?: string; source?: string; license?: string }
}

export type ValidationResult = { errors: string[]; warnings: string[] }
