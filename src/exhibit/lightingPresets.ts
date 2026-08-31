import type { LightingPresetId } from "../content/types"

type LightDefinition = {
  color: string
  intensity: number
  position: readonly [number, number, number]
  castShadow: boolean
}

export type LightingPreset = {
  label: string
  ambient: { color: string; intensity: number }
  key: LightDefinition & {
    kind: "directional" | "spot" | "point"
    angle?: number
    penumbra?: number
    distance?: number
  }
  fill?: LightDefinition & { kind: "directional" | "point" }
}

export const lightingPresets: Record<LightingPresetId, LightingPreset> = {
  warm: {
    label: "暖柜",
    ambient: { color: "#5f3822", intensity: 0.34 },
    key: {
      kind: "spot",
      color: "#ffd49a",
      intensity: 2.6,
      position: [2.6, 4.6, 3.2],
      castShadow: true,
      angle: 0.54,
      penumbra: 0.72,
    },
  },
  rim: {
    label: "轮廓",
    ambient: { color: "#472519", intensity: 0.24 },
    key: {
      kind: "directional",
      color: "#ffc58a",
      intensity: 2.4,
      position: [-3.8, 2.2, -2.6],
      castShadow: true,
    },
    fill: {
      kind: "point",
      color: "#7f9bc7",
      intensity: 0.8,
      position: [2.4, 0.4, 2.6],
      castShadow: false,
    },
  },
  moon: {
    label: "月光",
    ambient: { color: "#25365c", intensity: 0.34 },
    key: {
      kind: "directional",
      color: "#b7ceff",
      intensity: 1.95,
      position: [-4, 5.5, 2.4],
      castShadow: false,
    },
  },
  starlight: {
    label: "星光",
    ambient: { color: "#343052", intensity: 0.3 },
    key: {
      kind: "point",
      color: "#d9c8ff",
      intensity: 2.2,
      position: [3.5, 2.2, 2.8],
      castShadow: false,
      distance: 12,
    },
    fill: {
      kind: "point",
      color: "#77b7dc",
      intensity: 1.1,
      position: [-3, 0.5, -1.8],
      castShadow: false,
    },
  },
  top: {
    label: "顶光",
    ambient: { color: "#1a303c", intensity: 0.3 },
    key: {
      kind: "spot",
      color: "#d9f1ff",
      intensity: 2.8,
      position: [0.4, 5.8, 1.2],
      castShadow: false,
      angle: 0.48,
      penumbra: 0.56,
    },
  },
  scan: {
    label: "扫描",
    ambient: { color: "#182c34", intensity: 0.25 },
    key: {
      kind: "directional",
      color: "#7ee4ee",
      intensity: 2.25,
      position: [-4.4, 1.1, 2.2],
      castShadow: false,
    },
    fill: {
      kind: "point",
      color: "#cad8ff",
      intensity: 0.85,
      position: [3, 2.4, -2.4],
      castShadow: false,
    },
  },
}
