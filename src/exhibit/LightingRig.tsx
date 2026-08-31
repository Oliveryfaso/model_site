import type { LightingPresetId } from "../content/types"
import { lightingPresets, type LightingPreset } from "./lightingPresets"

function KeyLight({ light }: { light: LightingPreset["key"] }) {
  const common = {
    castShadow: light.castShadow,
    color: light.color,
    intensity: light.intensity,
    position: light.position,
  }

  if (light.kind === "spot") {
    return <spotLight {...common} angle={light.angle} penumbra={light.penumbra} />
  }
  if (light.kind === "point") {
    return <pointLight {...common} distance={light.distance} />
  }
  return <directionalLight {...common} />
}

function FillLight({ light }: { light: NonNullable<LightingPreset["fill"]> }) {
  const common = {
    castShadow: light.castShadow,
    color: light.color,
    intensity: light.intensity,
    position: light.position,
  }

  return light.kind === "point" ? <pointLight {...common} /> : <directionalLight {...common} />
}

export function LightingRig({ preset }: { preset: LightingPresetId }) {
  const lighting = lightingPresets[preset]

  return (
    <>
      <ambientLight color={lighting.ambient.color} intensity={lighting.ambient.intensity} />
      <KeyLight light={lighting.key} />
      {lighting.fill ? <FillLight light={lighting.fill} /> : null}
    </>
  )
}
