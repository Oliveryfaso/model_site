import { statSync } from "node:fs"
import { dirname, join, resolve, sep } from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { siteConfig } from "../src/app/siteConfig"
import { exhibits } from "../src/content/exhibits"
import { validateExhibits } from "../src/content/validateExhibits"

export function createPublicAssetFileChecker(publicDir: string) {
  const absolutePublicDir = resolve(publicDir)

  return (publicPath: string) => {
    if (!publicPath.startsWith("/") || publicPath.startsWith("//")) return false
    const absolutePath = resolve(absolutePublicDir, `.${publicPath}`)
    if (
      absolutePath !== absolutePublicDir &&
      !absolutePath.startsWith(`${absolutePublicDir}${sep}`)
    ) {
      return false
    }

    try {
      return statSync(absolutePath).isFile()
    } catch {
      return false
    }
  }
}

export function validateContent(publicDir: string) {
  return validateExhibits(exhibits, createPublicAssetFileChecker(publicDir), {
    themeTrack: siteConfig.themeTrack,
  })
}

function main() {
  const scriptDir = dirname(fileURLToPath(import.meta.url))
  const projectDir = join(scriptDir, "..")
  const result = validateContent(join(projectDir, "public"))

  for (const warning of result.warnings) console.warn(warning)
  for (const error of result.errors) console.error(error)
  if (result.errors.length > 0) process.exitCode = 1
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) main()
