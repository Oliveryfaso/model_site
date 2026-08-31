import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { createPublicAssetFileChecker } from "./validate-content"

const temporaryDirectories: string[] = []

describe("validate-content filesystem adapter", () => {
  afterEach(async () => {
    await Promise.all(
      temporaryDirectories.splice(0).map((directory) =>
        rm(directory, { force: true, recursive: true }),
      ),
    )
  })

  it("accepts regular in-root files but rejects directories and traversal", async () => {
    const publicDir = await mkdtemp(join(tmpdir(), "gallery-content-validation-"))
    temporaryDirectories.push(publicDir)
    await mkdir(join(publicDir, "covers", "directory.jpg"), { recursive: true })
    await writeFile(join(publicDir, "covers", "real.jpg"), "cover")
    const assetIsFile = createPublicAssetFileChecker(publicDir)

    expect(assetIsFile("/covers/real.jpg")).toBe(true)
    expect(assetIsFile("/covers/directory.jpg")).toBe(false)
    expect(assetIsFile("/../outside.jpg")).toBe(false)
  })
})
