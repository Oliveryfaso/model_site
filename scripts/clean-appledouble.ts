import { lstatSync, readdirSync, unlinkSync } from "node:fs"
import { resolve } from "node:path"
import { pathToFileURL } from "node:url"

export function removeAppleDoubleFiles(roots: readonly string[]): string[] {
  const removed: string[] = []

  const visit = (directory: string) => {
    for (const entry of readdirSync(directory, { withFileTypes: true })) {
      const entryPath = resolve(directory, entry.name)
      if (entry.name.startsWith("._") && (entry.isFile() || entry.isSymbolicLink())) {
        unlinkSync(entryPath)
        removed.push(entryPath)
        continue
      }
      if (entry.isDirectory()) visit(entryPath)
    }
  }

  for (const root of roots) {
    const absoluteRoot = resolve(root)
    let rootStat
    try {
      rootStat = lstatSync(absoluteRoot)
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === "ENOENT") continue
      throw error
    }
    if (!rootStat.isDirectory() || rootStat.isSymbolicLink()) continue
    visit(absoluteRoot)
  }
  return removed.sort()
}

function main() {
  const projectRoot = resolve(".")
  const roots = [resolve(projectRoot, "public"), resolve(projectRoot, "dist")]
  const removed = removeAppleDoubleFiles(roots)
  console.log(`Removed ${removed.length} AppleDouble file${removed.length === 1 ? "" : "s"} from public/dist.`)
}

const entryPoint = process.argv[1]
if (entryPoint && import.meta.url === pathToFileURL(resolve(entryPoint)).href) main()
