import { mkdirSync, readFileSync, symlinkSync, writeFileSync } from "node:fs"
import { mkdtemp, rm } from "node:fs/promises"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { afterEach, describe, expect, it } from "vitest"
import { removeAppleDoubleFiles } from "./clean-appledouble"

const temporaryRoots: string[] = []

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { force: true, recursive: true })))
})

describe("removeAppleDoubleFiles", () => {
  it("removes only AppleDouble sidecars under the supplied project roots", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "gallery-appledouble-"))
    temporaryRoots.push(fixture)
    const publicDir = join(fixture, "public")
    const externalDir = join(fixture, "outside")
    mkdirSync(join(publicDir, "models"), { recursive: true })
    mkdirSync(externalDir)
    writeFileSync(join(publicDir, "models", "model.glb"), "model")
    writeFileSync(join(publicDir, "models", "._model.glb"), "sidecar")
    writeFileSync(join(publicDir, ".gitkeep"), "keep")
    writeFileSync(join(externalDir, "._outside.glb"), "outside")
    symlinkSync(externalDir, join(publicDir, "linked-outside"))

    const removed = removeAppleDoubleFiles([publicDir])

    expect(removed).toEqual([join(publicDir, "models", "._model.glb")])
    expect(readFileSync(join(publicDir, "models", "model.glb"), "utf8")).toBe("model")
    expect(readFileSync(join(publicDir, ".gitkeep"), "utf8")).toBe("keep")
    expect(readFileSync(join(externalDir, "._outside.glb"), "utf8")).toBe("outside")
  })

  it("does not follow a supplied root that is itself a symlink", async () => {
    const fixture = await mkdtemp(join(tmpdir(), "gallery-appledouble-root-"))
    temporaryRoots.push(fixture)
    const externalDir = join(fixture, "outside")
    const publicLink = join(fixture, "public")
    mkdirSync(externalDir)
    writeFileSync(join(externalDir, "._outside.glb"), "outside")
    symlinkSync(externalDir, publicLink)

    const removed = removeAppleDoubleFiles([publicLink])

    expect(removed).toEqual([])
    expect(readFileSync(join(externalDir, "._outside.glb"), "utf8")).toBe("outside")
  })
})
