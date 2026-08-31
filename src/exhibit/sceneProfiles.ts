import type { CameraPreset, LightingPresetId, SceneId } from "../content/types"

export type SceneProfile = {
  background: string
  fog?: { color: string; near: number; far: number }
  defaultCamera: CameraPreset
  allowedLighting: LightingPresetId[]
  mobile: { disableParticles: boolean; shadows: boolean; maxDpr: number }
}

export const sceneProfiles: Record<SceneId, SceneProfile> = {
  "warm-cabinet": {
    background: "#120d09",
    fog: { color: "#120d09", near: 5, far: 13 },
    defaultCamera: {
      position: [0, 0.4, 4.2],
      target: [0, 0.2, 0],
      minDistance: 1.8,
      maxDistance: 7,
    },
    allowedLighting: ["warm", "rim"],
    mobile: { disableParticles: false, shadows: true, maxDpr: 1.5 },
  },
  "star-mist": {
    background: "#080b13",
    fog: { color: "#080b13", near: 7, far: 18 },
    defaultCamera: {
      position: [0.4, 1.1, 5.8],
      target: [0, 0.7, 0],
      minDistance: 2.8,
      maxDistance: 9,
    },
    allowedLighting: ["moon", "starlight"],
    mobile: { disableParticles: true, shadows: false, maxDpr: 1.25 },
  },
  "cold-chamber": {
    background: "#0b1115",
    fog: { color: "#0b1115", near: 6, far: 15 },
    defaultCamera: {
      position: [0.8, 0.7, 5],
      target: [0, 0.35, 0],
      minDistance: 2.2,
      maxDistance: 8,
    },
    allowedLighting: ["top", "scan"],
    mobile: { disableParticles: false, shadows: false, maxDpr: 1.25 },
  },
}
