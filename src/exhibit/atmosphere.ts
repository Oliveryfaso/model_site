import type { Exhibit } from "../content/types"

export type AtmospherePalette = {
  base: string
  shadow: string
  primary: string
  accent: string
}

export function resolveAtmospherePalette(exhibit: Exhibit): AtmospherePalette {
  const palette = exhibit.presentation.palette
  const [base, primary, accent] = palette
  return { base, shadow: base, primary, accent }
}
