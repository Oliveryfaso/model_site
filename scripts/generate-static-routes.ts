import { mkdir, readFile, writeFile } from "node:fs/promises"
import { dirname, join } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { siteConfig } from "../src/app/siteConfig"
import { exhibits } from "../src/content/exhibits"
import type { Exhibit } from "../src/content/types"

export type GenerateStaticRoutesOptions = {
  distDir: string
  origin: string
  exhibits: readonly Exhibit[]
  siteTitle: string
  siteDescription: string
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (character) => {
    const entities: Record<string, string> = {
      "&": "&amp;",
      "<": "&lt;",
      ">": "&gt;",
      '"': "&quot;",
      "'": "&#39;",
    }
    return entities[character]!
  })
}

function absoluteUrl(path: string, origin: string): string {
  return new URL(path, origin).href
}

function replaceMetadata(template: string, metadata: string): string {
  const startMarker = "<!--app-meta-start-->"
  const endMarker = "<!--app-meta-end-->"
  const startCount = template.split(startMarker).length - 1
  const endCount = template.split(endMarker).length - 1
  const startIndex = template.indexOf(startMarker)
  const endIndex = template.indexOf(endMarker)

  if (startCount !== 1 || endCount !== 1 || startIndex > endIndex) {
    throw new Error("Expected one correctly ordered app metadata region")
  }

  return `${template.slice(0, startIndex)}${metadata}${template.slice(endIndex + endMarker.length)}`
}

function assertSafeSlug(slug: string): void {
  if (slug === "." || slug === "..") {
    throw new Error(`Invalid exhibit slug: ${slug}`)
  }
}

function siteMetadata(options: GenerateStaticRoutesOptions, path: string): string {
  const canonicalUrl = absoluteUrl(path, options.origin)
  return `<!--app-meta-start-->
<title>${escapeHtml(options.siteTitle)}</title>
<meta name="description" content="${escapeHtml(options.siteDescription)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(options.siteTitle)}" />
<meta property="og:title" content="${escapeHtml(options.siteTitle)}" />
<meta property="og:description" content="${escapeHtml(options.siteDescription)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<!--app-meta-end-->`
}

function exhibitMetadata(exhibit: Exhibit, options: GenerateStaticRoutesOptions): string {
  const routePath = `/exhibits/${encodeURIComponent(exhibit.slug)}/`
  const canonicalUrl = absoluteUrl(routePath, options.origin)
  const shareTitle = exhibit.share?.title ?? exhibit.title
  const shareDescription = exhibit.share?.description ?? exhibit.summary
  const shareImage = exhibit.share?.image ?? exhibit.cover
  const shareImageUrl = absoluteUrl(shareImage, options.origin)

  return `<!--app-meta-start-->
<title>${escapeHtml(exhibit.title)} · ${escapeHtml(options.siteTitle)}</title>
<meta name="description" content="${escapeHtml(exhibit.summary)}" />
<link rel="canonical" href="${escapeHtml(canonicalUrl)}" />
<meta property="og:type" content="website" />
<meta property="og:site_name" content="${escapeHtml(options.siteTitle)}" />
<meta property="og:title" content="${escapeHtml(shareTitle)}" />
<meta property="og:description" content="${escapeHtml(shareDescription)}" />
<meta property="og:image" content="${escapeHtml(shareImageUrl)}" />
<meta property="og:image:alt" content="${escapeHtml(`${exhibit.title} 的馆藏封面`)}" />
<meta property="og:url" content="${escapeHtml(canonicalUrl)}" />
<!--app-meta-end-->`
}

async function writeRoute(distDir: string, route: string, html: string): Promise<void> {
  const outputPath = join(distDir, route, "index.html")
  await mkdir(dirname(outputPath), { recursive: true })
  await writeFile(outputPath, html, "utf8")
}

export async function generateStaticRoutes(options: GenerateStaticRoutesOptions): Promise<void> {
  for (const exhibit of options.exhibits) {
    assertSafeSlug(exhibit.slug)
  }

  const template = await readFile(join(options.distDir, "index.html"), "utf8")

  await writeRoute(options.distDir, "about", replaceMetadata(template, siteMetadata(options, "/about/")))

  await Promise.all(
    options.exhibits.map((exhibit) => {
      const slug = encodeURIComponent(exhibit.slug)
      return writeRoute(options.distDir, join("exhibits", slug), replaceMetadata(template, exhibitMetadata(exhibit, options)))
    }),
  )
}

const invokedAsScript = process.argv[1] !== undefined && pathToFileURL(process.argv[1]).href === import.meta.url

if (invokedAsScript) {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const distDir = join(scriptDir, "..", "dist")
  const origin = process.env.PUBLIC_ORIGIN ?? "http://localhost:4173"

  await generateStaticRoutes({
    distDir,
    origin,
    exhibits,
    siteTitle: siteConfig.siteTitle,
    siteDescription: siteConfig.siteDescription,
  })
}
