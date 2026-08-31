import { statSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"
import { siteConfig } from "../src/app/siteConfig"
import { exhibits as catalogExhibits } from "../src/content/exhibits"
import type { Exhibit } from "../src/content/types"

export type BudgetFinding = {
  level: "warning"
  path: string
  message: string
}

type BudgetCandidate = {
  path: string
  threshold: number
  message: string
}

const KIB = 1024
const MIB = 1024 * KIB

function publicAssetPath(publicDir: string, publicPath: string) {
  if (!publicPath.startsWith("/")) return undefined
  const absolutePublicDir = resolve(publicDir)
  const absolutePath = resolve(absolutePublicDir, `.${publicPath}`)
  if (absolutePath !== absolutePublicDir && !absolutePath.startsWith(`${absolutePublicDir}/`)) {
    return undefined
  }
  return absolutePath
}

export function checkAssetBudgets(
  publicDir: string,
  exhibits: readonly Exhibit[],
  statSize: (absolutePath: string) => number = (absolutePath) => statSync(absolutePath).size,
): BudgetFinding[] {
  const candidates: BudgetCandidate[] = []

  for (const exhibit of exhibits) {
    candidates.push({
      path: exhibit.model,
      threshold: 25 * MIB,
      message: "GLB exceeds 25 MB warning threshold",
    })
    candidates.push({
      path: exhibit.cover,
      threshold: 300 * KIB,
      message: "Homepage cover exceeds 300 KiB warning threshold",
    })
    if (exhibit.share?.image) {
      candidates.push({
        path: exhibit.share.image,
        threshold: MIB,
        message: "Share image exceeds 1 MiB warning threshold",
      })
    }
  }

  candidates.push({
    path: siteConfig.themeTrack,
    threshold: 3 * MIB,
    message: "Audio exceeds 3 MiB warning threshold",
  })
  for (const exhibit of exhibits) {
    if (!exhibit.audio?.ambientTrack) continue
    candidates.push({
      path: exhibit.audio.ambientTrack,
      threshold: 3 * MIB,
      message: "Audio exceeds 3 MiB warning threshold",
    })
  }

  const strictestCandidateByAbsolutePath = new Map<string, BudgetCandidate>()
  for (const candidate of candidates) {
    const absolutePath = publicAssetPath(publicDir, candidate.path)
    if (!absolutePath) continue
    const existing = strictestCandidateByAbsolutePath.get(absolutePath)
    if (!existing || candidate.threshold < existing.threshold) {
      strictestCandidateByAbsolutePath.set(absolutePath, candidate)
    }
  }

  const findings: BudgetFinding[] = []
  for (const [absolutePath, candidate] of strictestCandidateByAbsolutePath) {
    let size: number
    try {
      size = statSize(absolutePath)
    } catch {
      continue
    }
    if (size <= candidate.threshold) continue
    findings.push({ level: "warning", path: candidate.path, message: candidate.message })
  }

  return findings
}

function main() {
  const findings = checkAssetBudgets(resolve("public"), catalogExhibits)
  for (const finding of findings) {
    console.warn(`[asset-budget] ${finding.path}: ${finding.message}`)
  }
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) main()
