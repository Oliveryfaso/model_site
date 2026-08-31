import { exhibits } from "./exhibits"
import type { Exhibit } from "./types"

export function getExhibitBySlug(
  slug: string,
  source: readonly Exhibit[] = exhibits,
): Exhibit | undefined {
  return source.find((exhibit) => exhibit.slug === slug)
}

export function getFeaturedExhibit(
  source: readonly Exhibit[] = exhibits,
): Exhibit | undefined {
  return source.find((exhibit) => exhibit.featured === true)
}
